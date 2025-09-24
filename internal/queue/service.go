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

type Service struct {
	db           *gorm.DB
	operationSvc *operations.Service
	rbacSvc      *rbac.Service
	logger       *logging.Service

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

func NewService(db *gorm.DB, operationSvc *operations.Service, rbacSvc *rbac.Service, logger *logging.Service) *Service {
	ctx, cancel := context.WithCancel(context.Background())

	service := &Service{
		db:           db,
		operationSvc: operationSvc,
		rbacSvc:      rbacSvc,
		logger:       logger,
		stackWorkers: make(map[string]*StackWorker),
		ctx:          ctx,
		cancel:       cancel,
	}

	go service.processExistingQueue()

	return service
}

func (s *Service) EnqueueOperation(userID uint, serverID uint, stackName string, req operations.OperationRequest, webhookID *uint) (*models.QueuedOperationResponse, error) {
	s.logger.Debug("enqueuing single operation",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.String("command", req.Command),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackName, "stacks.manage")
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
		Order:       1,
		WebhookID:   webhookID,
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

	s.db.Preload("User").Preload("Server").Preload("Webhook").First(queuedOp, queuedOp.ID)

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

func (s *Service) EnqueueOperations(userID uint, serverID uint, stackName string, operations []operations.OperationRequest, webhookID *uint) (*models.BatchOperationResponse, error) {
	s.logger.Debug("enqueuing batch operations",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.Int("operation_count", len(operations)),
	)

	if len(operations) == 0 {
		return nil, fmt.Errorf("no operations provided")
	}

	for i, op := range operations {
		var requiredPermission string
		if op.Command == "create-archive" || op.Command == "extract-archive" {
			requiredPermission = "files.write"
		} else {
			requiredPermission = "stacks.manage"
		}

		hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackName, requiredPermission)
		if err != nil {
			s.logger.Error("failed to check permissions for batch operation",
				zap.Error(err),
				zap.Uint("user_id", userID),
				zap.Int("operation_index", i),
				zap.String("command", op.Command),
			)
			return nil, fmt.Errorf("failed to check permissions for operation %d: %w", i+1, err)
		}

		if !hasPermission {
			s.logger.Warn("batch operation permission denied",
				zap.Uint("user_id", userID),
				zap.Uint("server_id", serverID),
				zap.String("stack_name", stackName),
				zap.Int("operation_index", i),
				zap.String("command", op.Command),
				zap.String("required_permission", requiredPermission),
			)
			return nil, fmt.Errorf("insufficient permissions for operation %d '%s' on stack '%s' (requires %s)", i+1, op.Command, stackName, requiredPermission)
		}
	}

	batchID := s.generateBatchID()
	var queuedOps []*models.QueuedOperation

	for i, op := range operations {
		operationID := s.generateOperationID()
		queuedOp := &models.QueuedOperation{
			OperationID: operationID,
			BatchID:     &batchID,
			UserID:      userID,
			ServerID:    serverID,
			StackName:   stackName,
			Command:     op.Command,
			Options:     s.serializeStringArray(op.Options),
			Services:    s.serializeStringArray(op.Services),
			Status:      models.OperationStatusQueued,
			Order:       i + 1,
			WebhookID:   webhookID,
			QueuedAt:    time.Now(),
		}

		if i > 0 {
			queuedOp.DependsOn = &queuedOps[i-1].OperationID
		}

		queuedOps = append(queuedOps, queuedOp)
	}

	err := s.db.Create(&queuedOps).Error
	if err != nil {
		s.logger.Error("failed to create batch operations",
			zap.Error(err),
			zap.String("batch_id", batchID),
		)
		return nil, fmt.Errorf("failed to queue operations: %w", err)
	}

	s.submitToWorker(serverID, stackName, queuedOps[0])

	for i := range queuedOps {
		s.db.Preload("User").Preload("Server").Preload("Webhook").First(queuedOps[i], queuedOps[i].ID)
	}

	response := &models.BatchOperationResponse{
		BatchID:    batchID,
		Operations: make([]models.QueuedOperationResponse, len(queuedOps)),
	}

	for i, queuedOp := range queuedOps {
		opResponse := queuedOp.ToResponse()
		opResponse.PositionInQueue = s.getQueuePosition(serverID, stackName, queuedOp.OperationID)
		response.Operations[i] = opResponse
	}

	if len(response.Operations) > 0 {
		position := response.Operations[0].PositionInQueue
		estimatedStart := time.Now().Add(time.Duration(position-1) * 2 * time.Minute)
		estimatedStartStr := estimatedStart.Format("2006-01-02T15:04:05Z07:00")
		response.EstimatedStartTime = &estimatedStartStr
	}

	s.logger.Info("batch operations queued successfully",
		zap.String("batch_id", batchID),
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackName),
		zap.Int("operation_count", len(operations)),
	)

	return response, nil
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

func (s *Service) generateBatchID() string {
	return "batch_" + uuid.New().String()[:8]
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
