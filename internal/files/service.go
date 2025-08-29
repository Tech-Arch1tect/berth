package files

import (
	"brx-starter-kit/internal/agent"
	"brx-starter-kit/internal/rbac"
	"brx-starter-kit/internal/server"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"
)

type Service struct {
	agentSvc  *agent.Service
	serverSvc *server.Service
	rbacSvc   *rbac.Service
}

func NewService(agentSvc *agent.Service, serverSvc *server.Service, rbacSvc *rbac.Service) *Service {
	return &Service{
		agentSvc:  agentSvc,
		serverSvc: serverSvc,
		rbacSvc:   rbacSvc,
	}
}

func (s *Service) ListDirectory(ctx context.Context, userID uint, serverID uint, stackname, path string) (*DirectoryListing, error) {
	if err := s.checkFileReadPermission(userID, serverID, stackname); err != nil {
		return nil, err
	}

	server, err := s.serverSvc.GetServer(serverID)
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
	if err := s.checkFileReadPermission(userID, serverID, stackname); err != nil {
		return nil, err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/read?path=%s", stackname, url.QueryEscape(path))

	resp, err := s.agentSvc.MakeRequest(ctx, server, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, s.handleAgentError(resp)
	}

	var fileContent FileContent
	if err := json.NewDecoder(resp.Body).Decode(&fileContent); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}

	return &fileContent, nil
}

func (s *Service) WriteFile(ctx context.Context, userID uint, serverID uint, stackname string, req WriteFileRequest) error {
	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/write", stackname)
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
	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/delete", stackname)
	resp, err := s.agentSvc.MakeRequest(ctx, server, "DELETE", endpoint, req)
	if err != nil {
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return s.handleAgentError(resp)
	}

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

	server, err := s.serverSvc.GetServer(serverID)
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
	if err := s.checkFileWritePermission(userID, serverID, stackname); err != nil {
		return err
	}

	server, err := s.serverSvc.GetServer(serverID)
	if err != nil {
		return fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/files/upload", stackname)
	resp, err := s.agentSvc.MakeMultipartRequest(ctx, server, "POST", endpoint, path, fileHeader)
	if err != nil {
		return fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return s.handleAgentError(resp)
	}

	return nil
}

func (s *Service) checkFileReadPermission(userID uint, serverID uint, stackname string) error {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "files.read")
	if err != nil {
		return fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
		return fmt.Errorf("user does not have file read permission for this stack")
	}

	return nil
}

func (s *Service) checkFileWritePermission(userID uint, serverID uint, stackname string) error {
	hasPermission, err := s.rbacSvc.UserHasStackPermission(userID, serverID, stackname, "files.write")
	if err != nil {
		return fmt.Errorf("failed to check permissions: %w", err)
	}

	if !hasPermission {
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
