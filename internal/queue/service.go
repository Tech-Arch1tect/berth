package queue

import (
	"berth/internal/operations"
	"berth/internal/rbac"
	"berth/models"
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type queuePermissionChecker interface {
	UserHasStackPermission(ctx context.Context, userID, serverID uint, stackname, permissionName string) (bool, error)
}

type queueSecurityAuditor interface {
	LogAuthorizationDenied(actorUserID *uint, actorUsername, ip, resource, permission string, metadata map[string]any) error
}

type queueOperationExecutor interface {
	StartAndExecuteOperation(ctx context.Context, userID, serverID uint, stackname string, req operations.OperationRequest, operationLogID uint) (*operations.OperationResponse, error)
}

type Service struct {
	db           *gorm.DB
	operationSvc queueOperationExecutor
	rbacSvc      queuePermissionChecker
	logger       *logging.Service
	auditService queueSecurityAuditor

	operationTimeoutSeconds int

	stackWorkers map[string]*StackWorker
	workerMutex  sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

type StackWorker struct {
	stackKey string // "serverID:stackName"
	queue    chan *models.QueuedOperation
	active   bool
	logger   *logging.Service
	service  *Service
}

func NewService(db *gorm.DB, operationSvc queueOperationExecutor, rbacSvc queuePermissionChecker, logger *logging.Service, auditService queueSecurityAuditor, operationTimeoutSeconds int) *Service {
	ctx, cancel := context.WithCancel(context.Background())

	service := &Service{
		db:                      db,
		operationSvc:            operationSvc,
		rbacSvc:                 rbacSvc,
		logger:                  logger,
		auditService:            auditService,
		operationTimeoutSeconds: operationTimeoutSeconds,
		stackWorkers:            make(map[string]*StackWorker),
		ctx:                     ctx,
		cancel:                  cancel,
	}

	go service.processExistingQueue()

	return service
}

func (s *Service) EnqueueOperation(ctx context.Context, userID uint, serverID uint, stackName string, req operations.OperationRequest) (*models.QueuedOperationResponse, error) {
	s.logger.Debug("enqueuing single operation",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("command", req.Command),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackName, rbac.PermStacksManage)
	if err != nil {
		s.logger.Error("failed to check permissions for operation",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("operation permission denied",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackName),
			zap.String("command", req.Command),
		)

		s.auditService.LogAuthorizationDenied(
			&userID,
			"",
			"",
			fmt.Sprintf("stack:%s", stackName),
			rbac.PermStacksManage,
			map[string]any{
				"server_id": serverID,
				"command":   req.Command,
			},
		)

		return nil, fmt.Errorf("insufficient permissions for operation '%s' on stack '%s'", req.Command, stackName)
	}

	operationID := s.generateOperationID()
	queuedOp := &models.QueuedOperation{
		OperationID: operationID,
		UserID:      userID,
		ServerID:    serverID,
		StackName:   stackName,
		Command:     req.Command,
		Options:     s.serializeStringArray(req.Options),
		Services:    s.serializeStringArray(req.Services),
		Status:      models.OperationStatusQueued,
		QueuedAt:    time.Now(),
	}

	err = s.db.Create(queuedOp).Error
	if err != nil {
		s.logger.Error("failed to create queued operation",
			zap.Error(err),
			zap.String("operation_id", operationID),
		)
		return nil, fmt.Errorf("failed to queue operation: %w", err)
	}

	s.submitToWorker(serverID, stackName, queuedOp)

	s.db.Preload("User").Preload("Server").First(queuedOp, queuedOp.ID)

	response := queuedOp.ToResponse()
	response.PositionInQueue = s.getQueuePosition(serverID, stackName, operationID)

	s.logger.Info("operation queued successfully",
		zap.String("operation_id", operationID),
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("command", req.Command),
	)

	return &response, nil
}

func (s *Service) submitToWorker(serverID uint, stackName string, queuedOp *models.QueuedOperation) {
	stackKey := fmt.Sprintf("%d:%s", serverID, stackName)

	s.workerMutex.Lock()
	defer s.workerMutex.Unlock()

	worker, exists := s.stackWorkers[stackKey]
	if !exists {

		worker = &StackWorker{
			stackKey: stackKey,
			queue:    make(chan *models.QueuedOperation, 100),
			active:   true,
			logger:   s.logger,
			service:  s,
		}
		s.stackWorkers[stackKey] = worker

		s.wg.Add(1)
		go worker.process(s.ctx, &s.wg)
	}

	select {
	case worker.queue <- queuedOp:
		s.logger.Debug("operation submitted to worker",
			zap.String("stack_key", stackKey),
			zap.String("operation_id", queuedOp.OperationID),
		)
	default:
		s.logger.Error("worker queue is full",
			zap.String("stack_key", stackKey),
			zap.String("operation_id", queuedOp.OperationID),
		)
	}
}

func (s *Service) getQueuePosition(serverID uint, stackName string, operationID string) int {
	var count int64
	s.db.Model(&models.QueuedOperation{}).
		Where("server_id = ? AND stack_name = ? AND status = ? AND queued_at <= (SELECT queued_at FROM queued_operations WHERE operation_id = ?)",
			serverID, stackName, models.OperationStatusQueued, operationID).
		Count(&count)

	return int(count)
}

func (s *Service) processExistingQueue() {
	s.logger.Info("processing existing queued operations")

	var queuedOps []models.QueuedOperation
	err := s.db.Where("status = ?", models.OperationStatusQueued).
		Order("queued_at ASC").
		Find(&queuedOps).Error

	if err != nil {
		s.logger.Error("failed to load existing queued operations", zap.Error(err))
		return
	}

	s.logger.Info("found existing queued operations",
		zap.Int("count", len(queuedOps)),
	)

	for i := range queuedOps {
		s.submitToWorker(queuedOps[i].ServerID, queuedOps[i].StackName, &queuedOps[i])
	}
}

func (s *Service) generateOperationID() string {
	return "op_" + uuid.New().String()[:8]
}

func (s *Service) serializeStringArray(arr []string) string {
	if len(arr) == 0 {
		return ""
	}
	data, _ := json.Marshal(arr)
	return string(data)
}

func (s *Service) deserializeStringArray(data string) []string {
	if data == "" {
		return []string{}
	}
	var arr []string
	json.Unmarshal([]byte(data), &arr)
	return arr
}

func (s *Service) Shutdown() {
	s.logger.Info("shutting down queue service")
	s.cancel()
	s.wg.Wait()
	s.logger.Info("queue service shutdown complete")
}
