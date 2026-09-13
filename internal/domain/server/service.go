package server

import (
	"berth/internal/domain/authz"
	"berth/internal/pkg/agentsign"
	berthcrypto "berth/internal/pkg/crypto"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

var ErrServerInactive = errors.New("server is not active")

type serverAuthorizer interface {
	ReachableServerIDs(p authz.Principal) ([]uint, error)
}

type stackPatternProvider interface {
	GetUserAccessibleStackPatterns(userID, serverID uint) ([]string, error)
}

type serverAgentClient interface {
	MakeRequest(ctx context.Context, server *Server, method, endpoint string, payload any) (*http.Response, error)
	MakeReadRequest(ctx context.Context, server *Server, method, endpoint string, payload any) (*http.Response, error)
	HealthCheck(ctx context.Context, server *Server) error
}

type agentLifecycle interface {
	ConnectToAgent(server *Server) error
	DisconnectAgent(serverID uint)
}

type backupStorageGuard interface {
	ReserveBackupStorageTopologyRead() (func(), error)
	ReserveBackupStorageRead(serverID uint) (func(), error)
	ReserveBackupStorageWrite(serverID uint) (func(), error)
	RequireEmptyBackupStorage(ctx context.Context, serverID uint) error
}

type s3BucketValidator interface {
	Exists(ctx context.Context, id uint) (bool, error)
}

type ServerUpdateResult struct {
	Server               *Server
	BackupStorageChanged bool
	PreviousS3BucketID   *uint
}

type Service struct {
	db              *gorm.DB
	crypto          *berthcrypto.Crypto
	authzSvc        serverAuthorizer
	patternSvc      stackPatternProvider
	agentSvc        serverAgentClient
	agentLife       agentLifecycle
	backupStorage   backupStorageGuard
	bucketValidator s3BucketValidator
	logger          *zap.Logger
	authorityMutex  sync.Mutex
	signerMutex     sync.Mutex
	signer          *agentsign.Signer
}

func NewService(db *gorm.DB, crypto *berthcrypto.Crypto, authzSvc serverAuthorizer, patternSvc stackPatternProvider, agentSvc serverAgentClient, logger *zap.Logger) *Service {
	return &Service{
		db:         db,
		crypto:     crypto,
		authzSvc:   authzSvc,
		patternSvc: patternSvc,
		agentSvc:   agentSvc,
		logger:     logger,
	}
}

func (s *Service) SetAgentLifecycle(a agentLifecycle) {
	s.agentLife = a
}

func (s *Service) SetBackupStorageGuard(guard backupStorageGuard) {
	s.backupStorage = guard
}

func (s *Service) SetS3BucketValidator(validator s3BucketValidator) {
	s.bucketValidator = validator
}

func (s *Service) ListServers() ([]ServerInfo, error) {
	var servers []Server
	if err := s.db.Find(&servers).Error; err != nil {
		return nil, err
	}

	responses := make([]ServerInfo, len(servers))
	for i, server := range servers {
		responses[i] = server.ToResponse()
	}

	return responses, nil
}

func (s *Service) GetServer(id uint) (*Server, error) {
	return s.getServer(s.db, id)
}

func (s *Service) getServer(db *gorm.DB, id uint) (*Server, error) {
	var server Server
	if err := db.First(&server, id).Error; err != nil {
		return nil, err
	}

	decryptedToken, err := s.crypto.Decrypt(server.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}
	server.AccessToken = decryptedToken

	decryptedBackupPassword, err := s.crypto.Decrypt(server.BackupPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt backup password: %w", err)
	}
	server.BackupPassword = decryptedBackupPassword

	return &server, nil
}

func (s *Service) GetActiveServerForUser(ctx context.Context, id uint, p authz.Principal) (*Server, error) {
	s.logger.Debug("getting active server for user",
		zap.Uint("server_id", id),
		zap.Uint("user_id", p.UserID()),
	)

	var server Server
	if err := s.db.First(&server, id).Error; err != nil {
		s.logger.Error("failed to find server for user access",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, err
	}

	if !server.IsActive {
		s.logger.Warn("user attempted to access inactive server",
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, ErrServerInactive
	}

	serverIDs, err := s.authzSvc.ReachableServerIDs(p)
	if err != nil {
		s.logger.Error("failed to check user server access",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, fmt.Errorf("failed to get user accessible servers: %w", err)
	}

	hasAccess := slices.Contains(serverIDs, id)

	if !hasAccess {
		s.logger.Warn("user access denied to server",
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
			zap.Uint("user_id", p.UserID()),
		)
		return nil, fmt.Errorf("user does not have access to this server")
	}

	decryptedToken, err := s.crypto.Decrypt(server.AccessToken)
	if err != nil {
		s.logger.Error("failed to decrypt server access token",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		return nil, fmt.Errorf("failed to decrypt access token: %w", err)
	}
	server.AccessToken = decryptedToken

	decryptedBackupPassword, err := s.crypto.Decrypt(server.BackupPassword)
	if err != nil {
		s.logger.Error("failed to decrypt server backup password",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		return nil, fmt.Errorf("failed to decrypt backup password: %w", err)
	}
	server.BackupPassword = decryptedBackupPassword

	s.logger.Debug("server access granted to user",
		zap.Uint("server_id", id),
		zap.String("server_name", server.Name),
		zap.Uint("user_id", p.UserID()),
	)

	return &server, nil
}

func (s *Service) GetServerResponse(id uint) (*ServerInfo, error) {
	var server Server
	if err := s.db.First(&server, id).Error; err != nil {
		return nil, err
	}

	response := server.ToResponse()
	return &response, nil
}

func (s *Service) CreateServer(server *Server) error {
	s.logger.Info("creating new server",
		zap.String("name", server.Name),
		zap.String("host", server.Host),
		zap.Int("port", server.Port),
	)

	if server.AccessToken == "" {
		s.logger.Error("access token is required when creating a server",
			zap.String("server_name", server.Name),
		)
		return ErrServerAccessTokenRequired
	}

	var existing Server
	if err := s.db.Where("name = ?", server.Name).First(&existing).Error; err == nil {
		s.logger.Warn("server creation failed: name already exists",
			zap.String("name", server.Name),
			zap.Uint("existing_server_id", existing.ID),
		)
		return ErrServerNameTaken
	}

	encryptedToken, err := s.crypto.Encrypt(server.AccessToken)
	if err != nil {
		s.logger.Error("failed to encrypt server access token",
			zap.Error(err),
			zap.String("server_name", server.Name),
		)
		return fmt.Errorf("failed to encrypt access token: %w", err)
	}
	server.AccessToken = encryptedToken

	if server.BackupsEnabled && server.BackupPassword == "" {
		return ErrServerBackupPasswordRequired
	}
	encryptedBackupPassword, err := s.crypto.Encrypt(server.BackupPassword)
	if err != nil {
		s.logger.Error("failed to encrypt server backup password",
			zap.Error(err),
			zap.String("server_name", server.Name),
		)
		return fmt.Errorf("failed to encrypt backup password: %w", err)
	}
	server.BackupPassword = encryptedBackupPassword

	requestedInactive := !server.IsActive
	if err := s.db.Create(server).Error; err != nil {
		s.logger.Error("failed to create server in database",
			zap.Error(err),
			zap.String("name", server.Name),
			zap.String("host", server.Host),
		)
		return err
	}

	if requestedInactive {
		if err := s.db.Model(server).Update("is_active", false).Error; err != nil {
			s.logger.Error("failed to store the inactive state of a new server",
				zap.Error(err),
				zap.Uint("server_id", server.ID),
				zap.String("name", server.Name),
			)
			return err
		}
	}

	s.logger.Info("server created successfully",
		zap.Uint("server_id", server.ID),
		zap.String("name", server.Name),
		zap.String("host", server.Host),
		zap.Int("port", server.Port),
	)

	if s.agentLife != nil {
		if connectServer, err := s.GetServer(server.ID); err != nil {
			s.logger.Warn("failed to load server for agent connection after create",
				zap.Error(err), zap.Uint("server_id", server.ID))
		} else if err := s.agentLife.ConnectToAgent(connectServer); err != nil {
			s.logger.Warn("failed to open agent connection for new server",
				zap.Error(err), zap.Uint("server_id", server.ID))
		}
	}

	return nil
}

func (s *Service) UpdateServer(ctx context.Context, id uint, request *ServerUpdateRequest) (*ServerUpdateResult, error) {
	s.logger.Info("updating server",
		zap.Uint("server_id", id),
		zap.String("name", request.Name),
		zap.String("host", request.Host),
	)

	if s.backupStorage == nil {
		return nil, ErrBackupStorageUnavailable
	}
	if request.s3BucketIDSet {
		releaseTopology, err := s.backupStorage.ReserveBackupStorageTopologyRead()
		if err != nil {
			return nil, err
		}
		defer releaseTopology()
	}

	releaseServer, err := s.backupStorage.ReserveBackupStorageRead(id)
	if err != nil {
		return nil, err
	}
	defer func() {
		if releaseServer != nil {
			releaseServer()
		}
	}()

	server, err := s.loadServerForUpdate(ctx, id)
	if err != nil {
		return nil, err
	}
	var existing Server
	if err := s.db.Where("name = ? AND id != ?", request.Name, id).First(&existing).Error; err == nil {
		s.logger.Warn("server update failed: name already exists",
			zap.String("name", request.Name),
			zap.Uint("server_id", id),
			zap.Uint("existing_server_id", existing.ID),
		)
		return nil, ErrServerNameTaken
	}
	var previousS3BucketID *uint
	if serverUpdateNeedsWrite(&server, request) {
		releaseServer()
		releaseServer = nil
		releaseWrite, err := s.backupStorage.ReserveBackupStorageWrite(id)
		if err != nil {
			return nil, err
		}
		releaseServer = releaseWrite
		server, err = s.loadServerForUpdate(ctx, id)
		if err != nil {
			return nil, err
		}
		if server.S3BucketID != nil {
			bucketID := *server.S3BucketID
			previousS3BucketID = &bucketID
		}
	}

	storageChangeRequested := request.s3BucketIDSet && !sameS3BucketID(server.S3BucketID, request.S3BucketID)
	if storageChangeRequested {
		if request.S3BucketID != nil {
			if s.bucketValidator == nil {
				return nil, ErrBackupStorageUnavailable
			}
			exists, err := s.bucketValidator.Exists(ctx, *request.S3BucketID)
			if err != nil {
				return nil, fmt.Errorf("failed to validate s3 bucket configuration: %w", err)
			}
			if !exists {
				return nil, ErrServerS3BucketNotFound
			}
		}
		if err := s.backupStorage.RequireEmptyBackupStorage(ctx, id); err != nil {
			return nil, err
		}
	}

	updates := map[string]any{
		"name":                  request.Name,
		"description":           request.Description,
		"host":                  request.Host,
		"port":                  request.Port,
		"skip_ssl_verification": request.SkipSSLVerification,
		"is_active":             request.IsActive,
		"backups_enabled":       request.BackupsEnabled,
	}

	if request.AccessToken != "" {
		encryptedToken, err := s.crypto.Encrypt(request.AccessToken)
		if err != nil {
			s.logger.Error("failed to encrypt updated access token",
				zap.Error(err),
				zap.Uint("server_id", id),
			)
			return nil, fmt.Errorf("failed to encrypt access token: %w", err)
		}
		updates["access_token"] = encryptedToken
	}

	if request.BackupsEnabled && request.BackupPassword == "" && server.BackupPassword == "" {
		return nil, ErrServerBackupPasswordRequired
	}
	if request.BackupPassword != "" {
		encryptedBackupPassword, err := s.crypto.Encrypt(request.BackupPassword)
		if err != nil {
			s.logger.Error("failed to encrypt updated backup password",
				zap.Error(err),
				zap.Uint("server_id", id),
			)
			return nil, fmt.Errorf("failed to encrypt backup password: %w", err)
		}
		updates["backup_password"] = encryptedBackupPassword
	}
	if request.s3BucketIDSet {
		if request.S3BucketID == nil {
			updates["s3_bucket_id"] = nil
		} else {
			updates["s3_bucket_id"] = *request.S3BucketID
		}
	}

	var updated *Server
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&server).Updates(updates).Error; err != nil {
			s.logger.Error("failed to update server in database",
				zap.Error(err),
				zap.Uint("server_id", id),
				zap.String("name", request.Name),
			)
			return err
		}

		var err error
		updated, err = s.getServer(tx, id)
		if err != nil {
			s.logger.Error("failed to load server after update",
				zap.Error(err),
				zap.Uint("server_id", id),
			)
		}
		return err
	}); err != nil {
		return nil, err
	}

	s.logger.Info("server updated successfully",
		zap.Uint("server_id", id),
		zap.String("name", updated.Name),
		zap.String("host", updated.Host),
	)

	return &ServerUpdateResult{
		Server:               updated,
		BackupStorageChanged: storageChangeRequested && !sameS3BucketID(previousS3BucketID, updated.S3BucketID),
		PreviousS3BucketID:   previousS3BucketID,
	}, nil
}

func (s *Service) loadServerForUpdate(ctx context.Context, id uint) (Server, error) {
	var server Server
	if err := s.db.WithContext(ctx).First(&server, id).Error; err != nil {
		s.logger.Error("failed to find server for update",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Server{}, ErrServerNotFound
		}
		return Server{}, err
	}
	return server, nil
}

func serverUpdateNeedsWrite(current *Server, request *ServerUpdateRequest) bool {
	return current.Host != request.Host ||
		current.Port != request.Port ||
		!sameBoolPointer(current.SkipSSLVerification, request.SkipSSLVerification) ||
		request.AccessToken != "" ||
		request.BackupPassword != "" ||
		request.s3BucketIDSet && !sameS3BucketID(current.S3BucketID, request.S3BucketID)
}

func sameBoolPointer(left, right *bool) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func sameS3BucketID(left, right *uint) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func (s *Service) DeleteServer(ctx context.Context, id uint) (*Server, error) {
	s.logger.Info("deleting server",
		zap.Uint("server_id", id),
	)

	if s.backupStorage == nil {
		return nil, ErrBackupStorageUnavailable
	}
	releaseTopology, err := s.backupStorage.ReserveBackupStorageTopologyRead()
	if err != nil {
		return nil, err
	}
	defer releaseTopology()
	releaseServer, err := s.backupStorage.ReserveBackupStorageWrite(id)
	if err != nil {
		return nil, err
	}
	defer releaseServer()

	var server Server
	if err := s.db.WithContext(ctx).First(&server, id).Error; err != nil {
		s.logger.Error("failed to find server for deletion",
			zap.Error(err),
			zap.Uint("server_id", id),
		)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrServerNotFound
		}
		return nil, err
	}
	if err := s.backupStorage.RequireEmptyBackupStorage(ctx, id); err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&server).Update("s3_bucket_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&server).Error
	}); err != nil {
		s.logger.Error("failed to delete server from database",
			zap.Error(err),
			zap.Uint("server_id", id),
			zap.String("server_name", server.Name),
		)
		return nil, err
	}

	s.logger.Info("server deleted successfully",
		zap.Uint("server_id", id),
		zap.String("server_name", server.Name),
	)

	if s.agentLife != nil {
		s.agentLife.DisconnectAgent(id)
	}

	server.S3BucketID = nil
	return &server, nil
}

func (s *Service) TestServerConnection(ctx context.Context, server *Server) error {
	s.logger.Info("testing server connection",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
		zap.String("host", server.Host),
	)

	if err := s.agentSvc.HealthCheck(ctx, server); err != nil {
		s.logger.Error("server connection test failed",
			zap.Error(err),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return err
	}

	s.logger.Info("server connection test successful",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	return nil
}

func (s *Service) ListServersByIDs(serverIDs []uint) ([]ServerInfo, error) {
	if len(serverIDs) == 0 {
		return []ServerInfo{}, nil
	}

	var servers []Server
	if err := s.db.Where("id IN ? AND is_active = ?", serverIDs, true).Find(&servers).Error; err != nil {
		s.logger.Error("failed to query servers by ID",
			zap.Error(err),
			zap.Int("server_id_count", len(serverIDs)),
		)
		return nil, err
	}

	responses := make([]ServerInfo, len(servers))
	for i, server := range servers {
		responses[i] = server.ToResponse()
	}
	return responses, nil
}

func (s *Service) GetServerStatistics(ctx context.Context, p authz.Principal, serverID uint) (*StackStatistics, error) {

	accessibleServerIDs, err := s.authzSvc.ReachableServerIDs(p)
	if err != nil {
		return nil, err
	}

	hasAccess := slices.Contains(accessibleServerIDs, serverID)

	if !hasAccess {
		return nil, fmt.Errorf("user does not have access to server")
	}

	patterns, err := s.patternSvc.GetUserAccessibleStackPatterns(p.UserID(), serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user accessible patterns: %w", err)
	}

	if len(patterns) == 0 {
		return &StackStatistics{
			TotalStacks:     0,
			HealthyStacks:   0,
			UnhealthyStacks: 0,
		}, nil
	}

	server, err := s.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	patternsParam := strings.Join(patterns, ",")
	endpoint := fmt.Sprintf("/stacks/summary?patterns=%s", url.QueryEscape(patternsParam))

	resp, err := s.agentSvc.MakeReadRequest(ctx, server, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned error: %s", resp.Status)
	}

	var stackSummary StackStatistics
	if err := json.NewDecoder(resp.Body).Decode(&stackSummary); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &stackSummary, nil
}
