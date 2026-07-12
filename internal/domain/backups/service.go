package backups

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/server"

	"go.uber.org/zap"
)

var ErrBackupNotFound = errors.New("backup not found")
var ErrRepositoryBusy = errors.New("the backup repository is in use by another operation; try again once it finishes")
var ErrBackupsNotEnabled = errors.New("backups are not enabled for this server; an administrator can enable them and set an encryption password in the server settings")

type agentDeleteRequest struct {
	BackupPassword string `json:"backup_password"`
}

type agentErrorBody struct {
	Error string `json:"error"`
}

type backupsAgentClient interface {
	MakeRequest(ctx context.Context, server *server.Server, method, endpoint string, payload any) (*http.Response, error)
}

type backupsServerProvider interface {
	GetActiveServerForUser(ctx context.Context, id uint, p authz.Principal) (*server.Server, error)
}

type backupsAuthorizer interface {
	HasStackPermission(p authz.Principal, serverID uint, stackname, permission string) (bool, error)
}

type Service struct {
	agentSvc  backupsAgentClient
	serverSvc backupsServerProvider
	authzSvc  backupsAuthorizer
	logger    *zap.Logger
}

func NewService(agentSvc backupsAgentClient, serverSvc backupsServerProvider, authzSvc backupsAuthorizer, logger *zap.Logger) *Service {
	return &Service{
		agentSvc:  agentSvc,
		serverSvc: serverSvc,
		authzSvc:  authzSvc,
		logger:    logger,
	}
}

func (s *Service) checkReadPermission(p authz.Principal, serverID uint, stackname string) error {
	allowed, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.BackupsRead)
	if err != nil {
		return fmt.Errorf("failed to verify permission: %w", err)
	}
	if !allowed {
		return fmt.Errorf("access denied")
	}
	return nil
}

func (s *Service) ListBackups(ctx context.Context, p authz.Principal, serverID uint, stackname string, limit, offset int) (*ListResponse, error) {
	if err := s.checkReadPermission(p, serverID, stackname); err != nil {
		return nil, err
	}

	srv, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/backups?limit=%d&offset=%d", url.PathEscape(stackname), limit, offset)
	resp, err := s.agentSvc.MakeRequest(ctx, srv, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, s.handleAgentError(resp)
	}

	var listing ListResponse
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}
	listing.Enabled = srv.BackupsEnabled
	if listing.Runs == nil {
		listing.Runs = []RunSummary{}
	}
	return &listing, nil
}

func (s *Service) GetBackup(ctx context.Context, p authz.Principal, serverID uint, stackname, backupID string) (*Run, error) {
	if err := s.checkReadPermission(p, serverID, stackname); err != nil {
		return nil, err
	}

	srv, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	endpoint := fmt.Sprintf("/stacks/%s/backups/%s", url.PathEscape(stackname), url.PathEscape(backupID))
	resp, err := s.agentSvc.MakeRequest(ctx, srv, "GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrBackupNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, s.handleAgentError(resp)
	}

	var run Run
	if err := json.NewDecoder(resp.Body).Decode(&run); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}
	return &run, nil
}

func (s *Service) checkManagePermission(p authz.Principal, serverID uint, stackname string) error {
	allowed, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permnames.BackupsManage)
	if err != nil {
		return fmt.Errorf("failed to verify permission: %w", err)
	}
	if !allowed {
		return fmt.Errorf("access denied")
	}
	return nil
}

func (s *Service) DeleteBackup(ctx context.Context, p authz.Principal, serverID uint, stackname, backupID string) (*Run, error) {
	if err := s.checkManagePermission(p, serverID, stackname); err != nil {
		return nil, err
	}

	srv, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	if !srv.BackupsEnabled || srv.BackupPassword == "" {
		return nil, ErrBackupsNotEnabled
	}

	endpoint := fmt.Sprintf("/stacks/%s/backups/%s", url.PathEscape(stackname), url.PathEscape(backupID))

	var deleted *Run
	if detail, err := s.agentSvc.MakeRequest(ctx, srv, "GET", endpoint, nil); err == nil {
		if detail.StatusCode == http.StatusOK {
			var run Run
			if err := json.NewDecoder(detail.Body).Decode(&run); err == nil {
				deleted = &run
			}
		}
		_ = detail.Body.Close()
	}

	resp, err := s.agentSvc.MakeRequest(ctx, srv, "DELETE", endpoint, agentDeleteRequest{BackupPassword: srv.BackupPassword})
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK:
		return deleted, nil
	case http.StatusNotFound:
		return nil, ErrBackupNotFound
	case http.StatusConflict:
		return nil, ErrRepositoryBusy
	default:
		return nil, s.handleAgentError(resp)
	}
}

func (s *Service) handleAgentError(resp *http.Response) error {
	var errorResp agentErrorBody
	if err := json.NewDecoder(resp.Body).Decode(&errorResp); err == nil && errorResp.Error != "" {
		return fmt.Errorf("agent error: %s", errorResp.Error)
	}
	return fmt.Errorf("agent returned status %d", resp.StatusCode)
}
