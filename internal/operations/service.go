package operations

import (
	"berth/internal/files"
	"berth/internal/registry"
	"berth/models"
	"berth/utils"
	"bufio"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type opsServerProvider interface {
	GetActiveServerForUser(ctx context.Context, id, userID uint) (*models.Server, error)
	GetServer(id uint) (*models.Server, error)
}

type opsPermissionChecker interface {
	UserHasStackPermission(ctx context.Context, userID, serverID uint, stackname, permissionName string) (bool, error)
}

type opsRegistryProvider interface {
	GetCredentialForStack(serverID uint, stackName, registryURL string) (*registry.RegistryCredential, error)
}

type opsFileReader interface {
	ReadFile(ctx context.Context, userID, serverID uint, stackname, path string) (*files.FileContent, error)
}

type Service struct {
	serverSvc   opsServerProvider
	rbacSvc     opsPermissionChecker
	auditSvc    *AuditService
	registrySvc opsRegistryProvider
	filesSvc    opsFileReader
	logger      *logging.Service
}

func NewService(serverSvc opsServerProvider, rbacSvc opsPermissionChecker, auditSvc *AuditService, registrySvc opsRegistryProvider, filesSvc opsFileReader, logger *logging.Service) *Service {
	return &Service{
		serverSvc:   serverSvc,
		rbacSvc:     rbacSvc,
		auditSvc:    auditSvc,
		registrySvc: registrySvc,
		filesSvc:    filesSvc,
		logger:      logger,
	}
}

func (s *Service) StartOperation(ctx context.Context, userID uint, serverID uint, stackname string, req OperationRequest) (*OperationResponse, error) {
	s.logger.Debug("starting Docker operation",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("operation_command", req.Command),
	)

	serverModel, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for operation",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	var requiredPermission string
	if req.Command == "create-archive" || req.Command == "extract-archive" {
		requiredPermission = "files.write"
	} else {
		requiredPermission = "stacks.manage"
	}

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, requiredPermission)
	if err != nil {
		s.logger.Error("failed to check operation permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("required_permission", requiredPermission),
		)
		return nil, fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("operation permission denied",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("operation_command", req.Command),
			zap.String("required_permission", requiredPermission),
		)
		return nil, fmt.Errorf("insufficient permissions for operation '%s' on stack '%s' (requires %s)", req.Command, stackname, requiredPermission)
	}

	if req.Command == "up" || req.Command == "pull" {
		credentials, err := s.fetchRegistryCredentials(ctx, userID, serverID, stackname)
		if err != nil {
			s.logger.Warn("failed to fetch registry credentials, proceeding without them",
				zap.Error(err),
				zap.Uint("server_id", serverID),
				zap.String("stack_name", stackname),
			)
		} else if len(credentials) > 0 {
			req.RegistryCredentials = credentials
			s.logger.Info("added registry credentials to operation",
				zap.Int("credential_count", len(credentials)),
				zap.String("stack_name", stackname),
			)
		}
	}

	endpoint := fmt.Sprintf("/api/stacks/%s/operations", url.PathEscape(stackname))

	reqBody, err := json.Marshal(req)
	if err != nil {
		s.logger.Error("failed to marshal operation request",
			zap.Error(err),
			zap.String("operation_command", req.Command),
		)
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	s.logger.Debug("sending operation request to agent",
		zap.String("endpoint", endpoint),
		zap.String("server_name", serverModel.Name),
		zap.String("operation_command", req.Command),
	)

	agentResp, err := s.makeAgentRequest(ctx, serverModel, "POST", endpoint, reqBody)
	if err != nil {
		s.logger.Error("failed to communicate with agent for operation",
			zap.Error(err),
			zap.String("server_name", serverModel.Name),
			zap.String("endpoint", endpoint),
		)
		return nil, fmt.Errorf("failed to start operation on agent: %w", err)
	}
	defer func() { _ = agentResp.Body.Close() }()

	if agentResp.StatusCode != http.StatusOK {
		var errorResponse struct {
			Error string `json:"error"`
		}

		errorMsg := agentResp.Status
		if err := json.NewDecoder(agentResp.Body).Decode(&errorResponse); err == nil && errorResponse.Error != "" {
			errorMsg = errorResponse.Error
		}

		s.logger.Warn("agent returned error for operation",
			zap.Int("status_code", agentResp.StatusCode),
			zap.String("status", agentResp.Status),
			zap.String("error_message", errorMsg),
			zap.String("operation_command", req.Command),
			zap.String("stack_name", stackname),
		)
		return nil, fmt.Errorf("agent error: %s", errorMsg)
	}

	var response OperationResponse
	if err := json.NewDecoder(agentResp.Body).Decode(&response); err != nil {
		s.logger.Error("failed to decode operation response",
			zap.Error(err),
			zap.String("operation_command", req.Command),
		)
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	s.logger.Info("Docker operation started successfully",
		zap.Uint("user_id", userID),
		zap.String("server_name", serverModel.Name),
		zap.String("stack_name", stackname),
		zap.String("operation_command", req.Command),
		zap.String("operation_id", response.OperationID),
	)

	return &response, nil
}

func (s *Service) StartAndExecuteOperation(ctx context.Context, userID uint, serverID uint, stackname string, req OperationRequest, operationLogID uint) (*OperationResponse, error) {
	s.logger.Debug("starting and executing Docker operation",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("operation_command", req.Command),
		zap.Uint("operation_log_id", operationLogID),
	)

	response, err := s.StartOperation(ctx, userID, serverID, stackname, req)
	if err != nil {
		return nil, err
	}

	auditWriter := NewAuditWriter(s.auditSvc, operationLogID)
	err = s.StreamOperationToWriter(ctx, userID, serverID, stackname, response.OperationID, auditWriter)
	if err != nil {
		s.logger.Error("failed to execute operation via streaming",
			zap.Error(err),
			zap.String("operation_id", response.OperationID),
		)
		return response, err
	}

	s.logger.Info("Docker operation executed successfully",
		zap.Uint("user_id", userID),
		zap.String("stack_name", stackname),
		zap.String("operation_command", req.Command),
		zap.String("operation_id", response.OperationID),
	)

	return response, nil
}

func (s *Service) StreamOperationToWriter(ctx context.Context, userID uint, serverID uint, stackname string, operationID string, writer io.Writer) error {
	s.logger.Debug("starting operation stream",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("operation_id", operationID),
	)

	serverModel, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server for operation stream",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("operation_id", operationID),
		)
		return fmt.Errorf("failed to get server: %w", err)
	}

	hasPermission, err := s.rbacSvc.UserHasStackPermission(ctx, userID, serverID, stackname, "stacks.manage")
	if err != nil {
		s.logger.Error("failed to check stream permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
			zap.String("operation_id", operationID),
		)
		return fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("stream permission denied",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("operation_id", operationID),
		)
		return fmt.Errorf("insufficient permissions to access stack '%s' on server %d", stackname, serverID)
	}

	endpoint := fmt.Sprintf("/api/operations/%s/stream", url.PathEscape(operationID))

	s.logger.Debug("connecting to operation stream",
		zap.String("endpoint", endpoint),
		zap.String("server_name", serverModel.Name),
		zap.String("operation_id", operationID),
	)

	agentResp, err := s.makeAgentRequest(ctx, serverModel, "GET", endpoint, nil)
	if err != nil {
		s.logger.Error("failed to connect to agent stream",
			zap.Error(err),
			zap.String("server_name", serverModel.Name),
			zap.String("operation_id", operationID),
		)
		return fmt.Errorf("failed to connect to agent stream: %w", err)
	}
	defer func() { _ = agentResp.Body.Close() }()

	if agentResp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for stream",
			zap.Int("status_code", agentResp.StatusCode),
			zap.String("status", agentResp.Status),
			zap.String("operation_id", operationID),
		)
		return fmt.Errorf("agent returned error: %s", agentResp.Status)
	}

	s.logger.Info("operation stream connected successfully",
		zap.Uint("user_id", userID),
		zap.String("server_name", serverModel.Name),
		zap.String("stack_name", stackname),
		zap.String("operation_id", operationID),
	)

	return s.relaySSEStream(ctx, agentResp.Body, writer)
}

func (s *Service) relaySSEStream(ctx context.Context, reader io.Reader, writer io.Writer) error {
	s.logger.Debug("starting SSE stream relay")
	scanner := bufio.NewScanner(reader)
	lineCount := 0

	for {
		select {
		case <-ctx.Done():
			s.logger.Debug("SSE stream cancelled",
				zap.Int("lines_processed", lineCount),
			)
			return ctx.Err()
		default:
		}

		if !scanner.Scan() {
			if err := scanner.Err(); err != nil {
				s.logger.Error("error reading from SSE stream",
					zap.Error(err),
					zap.Int("lines_processed", lineCount),
				)
				return err
			}
			break
		}

		line := scanner.Text()
		lineCount++

		if strings.HasPrefix(line, "data: ") {
			if _, err := writer.Write([]byte(line + "\n\n")); err != nil {
				s.logger.Error("failed to write to output stream",
					zap.Error(err),
					zap.Int("lines_processed", lineCount),
				)
				return fmt.Errorf("failed to write to output stream: %w", err)
			}

			if flusher, ok := writer.(http.Flusher); ok {
				flusher.Flush()
			}
		}

		select {
		case <-ctx.Done():
			s.logger.Debug("SSE stream cancelled during processing",
				zap.Int("lines_processed", lineCount),
			)
			return ctx.Err()
		default:
		}
	}

	s.logger.Debug("SSE stream completed",
		zap.Int("total_lines_processed", lineCount),
	)

	return nil
}

func (s *Service) makeAgentRequest(ctx context.Context, serverModel *models.Server, method, endpoint string, body []byte) (*http.Response, error) {
	isStreamRequest := strings.Contains(endpoint, "/stream")

	s.logger.Debug("making agent request",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.String("server_host", serverModel.Host),
		zap.Int("server_port", serverModel.Port),
		zap.Bool("is_stream", isStreamRequest),
	)

	var client *http.Client
	if isStreamRequest {
		client = &http.Client{}
	} else {
		client = &http.Client{
			Timeout: 30 * time.Second,
		}
	}

	if serverModel.SkipSSLVerification != nil && *serverModel.SkipSSLVerification {
		s.logger.Debug("SSL verification disabled for agent request",
			zap.String("server_host", serverModel.Host),
		)
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		}
	}

	agentURL := fmt.Sprintf("https://%s:%d%s", serverModel.Host, serverModel.Port, endpoint)

	var bodyReader io.Reader
	if body != nil {
		bodyReader = strings.NewReader(string(body))
	}

	req, err := http.NewRequestWithContext(ctx, method, agentURL, bodyReader)
	if err != nil {
		s.logger.Error("failed to create agent request",
			zap.Error(err),
			zap.String("method", method),
			zap.String("url", agentURL),
		)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if serverModel.AccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+serverModel.AccessToken)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	if isStreamRequest {
		req.Header.Set("Accept", "text/event-stream")
		req.Header.Set("Cache-Control", "no-cache")
	}

	resp, err := client.Do(req)
	if err != nil {
		s.logger.Error("agent request failed",
			zap.Error(err),
			zap.String("method", method),
			zap.String("url", agentURL),
		)
		return nil, err
	}

	s.logger.Debug("agent request completed",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.Int("status_code", resp.StatusCode),
		zap.String("status", resp.Status),
	)

	return resp, nil
}

type AuditWriter struct {
	auditSvc       *AuditService
	operationLogID uint
	sequenceNumber int
}

func NewAuditWriter(auditSvc *AuditService, operationLogID uint) *AuditWriter {
	return &AuditWriter{
		auditSvc:       auditSvc,
		operationLogID: operationLogID,
		sequenceNumber: 0,
	}
}

func (w *AuditWriter) Write(p []byte) (n int, err error) {
	data := string(p)
	lines := strings.Split(data, "\n")

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		if len(line) > 6 && line[:6] == "data: " {
			jsonData := line[6:]

			var streamMsg StreamMessage
			if json.Unmarshal([]byte(jsonData), &streamMsg) == nil {
				w.sequenceNumber++

				_ = w.auditSvc.LogOperationMessage(
					w.operationLogID,
					streamMsg.Type,
					streamMsg.Data,
					streamMsg.Timestamp,
					w.sequenceNumber,
				)

				if streamMsg.Type == "complete" {
					success := streamMsg.Success != nil && *streamMsg.Success
					exitCode := 0
					if streamMsg.ExitCode != nil {
						exitCode = *streamMsg.ExitCode
					}

					_ = w.auditSvc.LogOperationEnd(
						w.operationLogID,
						streamMsg.Timestamp,
						success,
						exitCode,
					)
				}
			}
		}
	}

	return len(p), nil
}

func (s *Service) fetchRegistryCredentials(ctx context.Context, userID uint, serverID uint, stackname string) ([]RegistryCredential, error) {

	fileContent, err := s.filesSvc.ReadFile(ctx, userID, serverID, stackname, "docker-compose.yml")
	if err != nil {

		fileContent, err = s.filesSvc.ReadFile(ctx, userID, serverID, stackname, "docker-compose.yaml")
		if err != nil {
			return nil, fmt.Errorf("failed to read compose file: %w", err)
		}
	}

	registries, err := utils.ExtractRegistries(fileContent.Content)
	if err != nil {
		return nil, fmt.Errorf("failed to extract registries: %w", err)
	}

	if len(registries) == 0 {
		s.logger.Debug("no registries found in compose file",
			zap.String("stack_name", stackname),
		)
		return nil, nil
	}

	s.logger.Debug("extracted registries from compose file",
		zap.String("stack_name", stackname),
		zap.Strings("registries", registries),
	)

	var credentials []RegistryCredential
	for _, registry := range registries {
		normalizedRegistry := utils.NormalizeRegistryURL(registry)

		cred, err := s.registrySvc.GetCredentialForStack(serverID, stackname, normalizedRegistry)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				s.logger.Debug("no credential found for registry",
					zap.String("stack_name", stackname),
					zap.String("registry", normalizedRegistry),
				)
				continue
			}
			s.logger.Warn("failed to get credential for registry",
				zap.Error(err),
				zap.String("stack_name", stackname),
				zap.String("registry", normalizedRegistry),
			)
			continue
		}

		s.logger.Debug("found credential for registry",
			zap.String("stack_name", stackname),
			zap.String("registry", normalizedRegistry),
			zap.String("username", cred.Username),
		)

		credentials = append(credentials, RegistryCredential{
			Registry: cred.Registry,
			Username: cred.Username,
			Password: cred.Password,
		})
	}

	return credentials, nil
}
