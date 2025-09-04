package files

import (
	"berth/internal/agent"
	"berth/internal/rbac"
	"berth/internal/server"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type Service struct {
	agentSvc  *agent.Service
	serverSvc *server.Service
	rbacSvc   *rbac.Service
	logger    *logging.Service
}

func NewService(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service, logger *logging.Service) *Service {
	return &Service{
		agentSvc:  agentSvc,
		serverSvc: serverSvc,
		rbacSvc:   rbacSvc,
		logger:    logger,
	}
}

func (s *Service) ListDirectory(ctx context.Context, userID uint, serverID uint, stackname, path string) (*DirectoryListing, error) {
	if err := s.checkFileReadPermission(userID, serverID, stackname); err != nil {
		return nil, err
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files", stackname)
	if path != "" {
		endpoint += "?path=" + url.QueryEscape(path)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, s.handleAgentError(resp)
	}

	var listing DirectoryListing
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &listing, nil
}

func (s *Service) ReadFile(ctx context.Context, userID uint, serverID uint, stackname, path string) (*FileContent, error) {
	s.logger.Debug("file read operation initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("file_path", path),
	)

	if err := s.checkFileReadPermission(userID, serverID, stackname); err != nil {
		s.logger.Warn("file read permission denied",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
			zap.String("file_path", path),
		)
		return nil, err
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		s.logger.Error("failed to get server for file read",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/read?path=%s", stackname, url.QueryEscape(path))

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", endpoint, nil)
	if err != nil {
		s.logger.Error("failed to read file via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("file_path", path),
		)
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for file read",
			zap.Int("status_code", resp.StatusCode),
			zap.String("file_path", path),
		)
		return nil, s.handleAgentError(resp)
	}

	var fileContent FileContent
	if err := json.NewDecoder(resp.Body).Decode(&fileContent); err != nil {
		s.logger.Error("failed to decode file content response",
			zap.Error(err),
			zap.String("file_path", path),
		)
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	s.logger.Debug("file read successfully",
		zap.Uint("user_id", userID),
		zap.String("stack_name", stackname),
		zap.String("file_path", path),
	)

	return &fileContent, nil
}

func (s *Service) WriteFile(ctx context.Context, userID uint, serverID uint, stackname string, req WriteFileRequest) error {
	s.logger.Info("file write operation initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("file_path", req.Path),
	)

	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		s.logger.Warn("file write permission denied",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
			zap.String("file_path", req.Path),
		)
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server for file write",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/write", stackname)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", endpoint, req)
	if err != nil {
		s.logger.Error("failed to write file via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("file_path", req.Path),
		)
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for file write",
			zap.Int("status_code", resp.StatusCode),
			zap.String("file_path", req.Path),
		)
		return s.handleAgentError(resp)
	}

	s.logger.Info("file written successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("file_path", req.Path),
	)

	return nil
}

func (s *Service) CreateDirectory(ctx context.Context, userID uint, serverID uint, stackname string, req CreateDirectoryRequest) error {
	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/mkdir", stackname)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", endpoint, req)
	if err != nil {
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return s.handleAgentError(resp)
	}

	return nil
}

func (s *Service) Delete(ctx context.Context, userID uint, serverID uint, stackname string, req DeleteRequest) error {
	s.logger.Info("file deletion operation initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("target_path", req.Path),
	)

	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		s.logger.Warn("file deletion permission denied",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
			zap.String("target_path", req.Path),
		)
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server for file deletion",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/delete", stackname)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "DELETE", endpoint, req)
	if err != nil {
		s.logger.Error("failed to delete file via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("target_path", req.Path),
		)
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for file deletion",
			zap.Int("status_code", resp.StatusCode),
			zap.String("target_path", req.Path),
		)
		return s.handleAgentError(resp)
	}

	s.logger.Info("file deleted successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("target_path", req.Path),
	)

	return nil
}

func (s *Service) Rename(ctx context.Context, userID uint, serverID uint, stackname string, req RenameRequest) error {
	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/rename", stackname)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", endpoint, req)
	if err != nil {
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return s.handleAgentError(resp)
	}

	return nil
}

func (s *Service) Copy(ctx context.Context, userID uint, serverID uint, stackname string, req CopyRequest) error {
	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/copy", stackname)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", endpoint, req)
	if err != nil {
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return s.handleAgentError(resp)
	}

	return nil
}

func (s *Service) DownloadFile(ctx context.Context, userID uint, serverID uint, stackname, path, filename string) (*http.Response, error) {
	if err := s.checkFileReadPermission(userID, serverID, stackname); err != nil {
		return nil, err
	}

	server, err := s.serverSvc.GetActiveServerForUser(serverID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/download?path=%s", stackname, url.QueryEscape(path))
	if filename != "" {
		endpoint += "&filename=" + url.QueryEscape(filename)
	}

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer func() { _ = resp.Body.Close() }()
		return nil, s.handleAgentError(resp)
	}

	return resp, nil
}

func (s *Service) UploadFile(ctx context.Context, userID uint, serverID uint, stackname, path string, fileHeader *multipart.FileHeader) error {
	s.logger.Info("file upload operation initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("upload_path", path),
		zap.String("filename", fileHeader.Filename),
		zap.Int64("file_size", fileHeader.Size),
	)

	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		s.logger.Warn("file upload permission denied",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
			zap.String("filename", fileHeader.Filename),
		)
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server for file upload",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/upload", stackname)
	resp, err := s.agentSvc.MakeMultipartRequest(ctx, server, "POST", endpoint, path, fileHeader)
	if err != nil {
		s.logger.Error("failed to upload file via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("filename", fileHeader.Filename),
			zap.Int64("file_size", fileHeader.Size),
		)
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for file upload",
			zap.Int("status_code", resp.StatusCode),
			zap.String("filename", fileHeader.Filename),
		)
		return s.handleAgentError(resp)
	}

	s.logger.Info("file uploaded successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("upload_path", path),
		zap.String("filename", fileHeader.Filename),
		zap.Int64("file_size", fileHeader.Size),
	)

	return nil
}

func (s *Service) Chmod(ctx context.Context, userID uint, serverID uint, stackname string, req ChmodRequest) error {
	s.logger.Info("chmod operation initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("target_path", req.Path),
		zap.String("mode", req.Mode),
	)

	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		s.logger.Warn("chmod permission denied",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
			zap.String("target_path", req.Path),
			zap.String("mode", req.Mode),
		)
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server for chmod",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/chmod", stackname)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", endpoint, req)
	if err != nil {
		s.logger.Error("failed to chmod via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("target_path", req.Path),
			zap.String("mode", req.Mode),
		)
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for chmod",
			zap.Int("status_code", resp.StatusCode),
			zap.String("target_path", req.Path),
			zap.String("mode", req.Mode),
		)
		return s.handleAgentError(resp)
	}

	s.logger.Info("chmod completed successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("target_path", req.Path),
		zap.String("mode", req.Mode),
	)

	return nil
}

func (s *Service) Chown(ctx context.Context, userID uint, serverID uint, stackname string, req ChownRequest) error {
	s.logger.Info("chown operation initiated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("target_path", req.Path),
		zap.Any("owner_id", req.OwnerID),
		zap.Any("group_id", req.GroupID),
		zap.Bool("recursive", req.Recursive),
	)

	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		s.logger.Warn("chown permission denied",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
			zap.String("target_path", req.Path),
		)
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		s.logger.Error("failed to get server for chown",
			zap.Error(err),
			zap.Uint("server_id", serverID),
		)
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/chown", stackname)
	s.logger.Info("making request to agent",
		zap.String("endpoint", endpoint),
		zap.Any("request", req),
	)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "POST", endpoint, req)
	if err != nil {
		s.logger.Error("failed to chown via agent",
			zap.Error(err),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
			zap.String("target_path", req.Path),
		)
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent returned error for chown",
			zap.Int("status_code", resp.StatusCode),
			zap.String("target_path", req.Path),
		)
		return s.handleAgentError(resp)
	}

	s.logger.Info("chown completed successfully",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.String("target_path", req.Path),
	)

	return nil
}

func (s *Service) checkFileReadPermission(userID uint, serverID uint, stackname string) error {
	s.logger.Debug("checking file read permission",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "files.read")
	if err != nil {
		s.logger.Error("failed to check file read permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
		)
		return fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user lacks file read permission",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return fmt.Errorf("user does not have file read permission for this stack")
	}

	return nil
}

func (s *Service) checkFileWritePermission(userID uint, serverID uint, stackname string) error {
	s.logger.Debug("checking file write permission",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
	)

	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "files.write")
	if err != nil {
		s.logger.Error("failed to check file write permission",
			zap.Error(err),
			zap.Uint("user_id", userID),
			zap.String("stack_name", stackname),
		)
		return fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		s.logger.Warn("user lacks file write permission",
			zap.Uint("user_id", userID),
			zap.Uint("server_id", serverID),
			zap.String("stack_name", stackname),
		)
		return fmt.Errorf("user does not have file write permission for this stack")
	}

	return nil
}

func (s *Service) handleAgentError(resp *http.Response) error {
	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("resource not found")
	}

	if resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("access denied")
	}

	var errorResp ErrorResponse
	if err := json.NewDecoder(resp.Body).Decode(&errorResp); err == nil {
		return fmt.Errorf("agent error: %s", errorResp.Error)
	}

	return fmt.Errorf("agent returned status %d", resp.StatusCode)
}
