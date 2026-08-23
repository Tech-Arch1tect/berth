package backups

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/s3buckets"
	"berth/internal/domain/server"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

var ErrBackupNotFound = errors.New("backup not found")
var ErrRepositoryBusy = errors.New("the backup repository is in use by another operation; try again once it finishes")
var ErrBackupsNotEnabled = errors.New("backups are not enabled for this server; an administrator can enable them and set an encryption password in the server settings")
var ErrAccessDenied = errors.New("access denied")
var ErrBackupStorageUnavailable = errors.New("backup storage status is unavailable")
var ErrServerNotFound = errors.New("server not found")

const backupPasswordHeader = "X-Backup-Password"
const backupS3RepositoryHeader = "X-Backup-S3-Repository"

type agentDeleteRequest struct {
	BackupPassword string                  `json:"backup_password"`
	S3Repository   *s3buckets.S3Repository `json:"s3_repository,omitempty"`
}

type agentErrorBody struct {
	Error string `json:"error"`
}

type backupsAgentClient interface {
	MakeRequest(ctx context.Context, server *server.Server, method, endpoint string, payload any) (*http.Response, error)
	MakeReadRequest(ctx context.Context, server *server.Server, method, endpoint string, payload any) (*http.Response, error)
	MakeReadRequestWithHeaders(ctx context.Context, server *server.Server, method, endpoint string, payload any, headers map[string]string) (*http.Response, error)
	MakeStreamRequestWithHeaders(ctx context.Context, server *server.Server, method, endpoint string, headers map[string]string) (*http.Response, error)
}

type backupsServerProvider interface {
	GetServer(id uint) (*server.Server, error)
	GetActiveServerForUser(ctx context.Context, id uint, p authz.Principal) (*server.Server, error)
}

type backupsAuthorizer interface {
	HasStackPermission(p authz.Principal, serverID uint, stackname, permission string) (bool, error)
	HasServerPermission(p authz.Principal, serverID uint, permission string) (bool, error)
}

type backupsBucketResolver interface {
	RepositoryForServer(ctx context.Context, serverID uint, stackName string) (*s3buckets.S3Repository, error)
}

type Service struct {
	agentSvc        backupsAgentClient
	serverSvc       backupsServerProvider
	authzSvc        backupsAuthorizer
	bucketSvc       backupsBucketResolver
	storageTopology storageTopology
	storageLocks    *storageLockTable
	logger          *zap.Logger
}

func NewService(agentSvc backupsAgentClient, serverSvc backupsServerProvider, authzSvc backupsAuthorizer, bucketSvc backupsBucketResolver, logger *zap.Logger) *Service {
	return &Service{
		agentSvc:     agentSvc,
		serverSvc:    serverSvc,
		authzSvc:     authzSvc,
		bucketSvc:    bucketSvc,
		storageLocks: newStorageLockTable(),
		logger:       logger,
	}
}

func (s *Service) repositoryFor(ctx context.Context, serverID uint, stackname string) (*s3buckets.S3Repository, error) {
	if s.bucketSvc == nil {
		return nil, nil
	}
	return s.bucketSvc.RepositoryForServer(ctx, serverID, stackname)
}

func (s *Service) headersFor(ctx context.Context, srv *server.Server, stackname string) (map[string]string, error) {
	headers := map[string]string{backupPasswordHeader: srv.BackupPassword}
	repository, err := s.repositoryFor(ctx, srv.ID, stackname)
	if err != nil {
		return nil, err
	}
	if repository != nil {
		encoded, marshalErr := json.Marshal(repository)
		if marshalErr != nil {
			return nil, fmt.Errorf("failed to encode the server's s3 repository: %w", marshalErr)
		}
		headers[backupS3RepositoryHeader] = string(encoded)
	}
	return headers, nil
}

func (s *Service) BackupStorageStatus(ctx context.Context, serverID uint) (*HistoryState, error) {
	srv, err := s.serverSvc.GetServer(serverID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrServerNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeReadRequest(ctx, srv, http.MethodGet, "/backups/history", nil)
	if err != nil {
		s.logger.Warn("failed to read backup storage status from agent",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("%w: agent request failed", ErrBackupStorageUnavailable)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusConflict {
		return nil, ErrRepositoryBusy
	}
	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent refused backup storage status request",
			zap.Uint("server_id", serverID),
			zap.Int("status_code", resp.StatusCode),
		)
		return nil, fmt.Errorf("%w: agent returned status %d", ErrBackupStorageUnavailable, resp.StatusCode)
	}

	decoder := json.NewDecoder(resp.Body)
	var wireState agentHistoryState
	if err := decoder.Decode(&wireState); err != nil {
		s.logger.Warn("failed to decode backup storage status from agent",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("%w: agent response could not be decoded", ErrBackupStorageUnavailable)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		s.logger.Warn("rejected trailing data in backup storage status from agent",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("%w: agent response contained trailing data", ErrBackupStorageUnavailable)
	}
	state, valid := wireState.state()
	if !valid {
		s.logger.Warn("rejected inconsistent backup storage status from agent",
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("%w: agent response was inconsistent", ErrBackupStorageUnavailable)
	}
	return &state, nil
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
	release, err := s.ReserveBackupStorageRead(serverID)
	if err != nil {
		return nil, err
	}
	defer release()

	srv, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	if !srv.BackupsEnabled || srv.BackupPassword == "" {
		return nil, ErrBackupsNotEnabled
	}

	endpoint := fmt.Sprintf("/stacks/%s/backups/%s", url.PathEscape(stackname), url.PathEscape(backupID))

	repository, err := s.repositoryFor(ctx, serverID, stackname)
	if err != nil {
		return nil, err
	}

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

	resp, err := s.agentSvc.MakeRequest(ctx, srv, "DELETE", endpoint, agentDeleteRequest{BackupPassword: srv.BackupPassword, S3Repository: repository})
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

type rebuildRequest struct {
	BackupPassword string                  `json:"backup_password"`
	S3Repository   *s3buckets.S3Repository `json:"s3_repository,omitempty"`
}

type RebuildResult struct {
	RunsInRepository int      `json:"runs_in_repository"`
	RunsAdded        int      `json:"runs_added"`
	Output           []string `json:"output"`
}

func (s *Service) RebuildBackupIndex(ctx context.Context, p authz.Principal, serverID uint, stackname string) (*RebuildResult, error) {
	if err := s.checkManagePermission(p, serverID, stackname); err != nil {
		return nil, err
	}
	release, err := s.ReserveBackupStorageRead(serverID)
	if err != nil {
		return nil, err
	}
	defer release()

	srv, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	if !srv.BackupsEnabled || srv.BackupPassword == "" {
		return nil, ErrBackupsNotEnabled
	}

	endpoint := fmt.Sprintf("/stacks/%s/backups/rebuild", url.PathEscape(stackname))

	repository, err := s.repositoryFor(ctx, serverID, stackname)
	if err != nil {
		return nil, err
	}

	resp, err := s.agentSvc.MakeRequest(ctx, srv, "POST", endpoint, rebuildRequest{BackupPassword: srv.BackupPassword, S3Repository: repository})
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, s.handleAgentError(resp)
	}

	var result RebuildResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}
	return &result, nil
}

func (s *Service) checkBrowsePermission(p authz.Principal, serverID uint, stackname string) error {
	for _, permission := range []string{permnames.BackupsRead, permnames.FilesRead} {
		allowed, err := s.authzSvc.HasStackPermission(p, serverID, stackname, permission)
		if err != nil {
			return fmt.Errorf("failed to verify permission: %w", err)
		}
		if !allowed {
			return ErrAccessDenied
		}
	}
	return nil
}

func (s *Service) browseServer(ctx context.Context, p authz.Principal, serverID uint, stackname string) (*server.Server, error) {
	if err := s.checkBrowsePermission(p, serverID, stackname); err != nil {
		return nil, err
	}
	srv, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}
	if !srv.BackupsEnabled || srv.BackupPassword == "" {
		return nil, ErrBackupsNotEnabled
	}
	return srv, nil
}

func (s *Service) ListBackupFiles(ctx context.Context, p authz.Principal, serverID uint, stackname, backupID, componentID, path string) (*BackupFileListing, error) {
	release, err := s.ReserveBackupStorageRead(serverID)
	if err != nil {
		return nil, err
	}
	defer release()

	srv, err := s.browseServer(ctx, p, serverID, stackname)
	if err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("/stacks/%s/backups/%s/files?component=%s&path=%s",
		url.PathEscape(stackname), url.PathEscape(backupID), url.QueryEscape(componentID), url.QueryEscape(path))
	headers, err := s.headersFor(ctx, srv, stackname)
	if err != nil {
		return nil, err
	}
	resp, err := s.agentSvc.MakeReadRequestWithHeaders(ctx, srv, "GET", endpoint, nil, headers)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return nil, ErrBackupNotFound
	case http.StatusConflict:
		return nil, ErrRepositoryBusy
	default:
		return nil, s.handleAgentError(resp)
	}

	var listing BackupFileListing
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("failed to decode agent response: %w", err)
	}
	if listing.Entries == nil {
		listing.Entries = []BackupFileEntry{}
	}
	return &listing, nil
}

func (s *Service) DownloadBackupFiles(ctx context.Context, p authz.Principal, serverID uint, stackname, backupID, componentID string, paths []string) (*http.Response, error) {
	release, err := s.ReserveBackupStorageRead(serverID)
	if err != nil {
		return nil, err
	}
	held := true
	defer func() {
		if held {
			release()
		}
	}()

	srv, err := s.browseServer(ctx, p, serverID, stackname)
	if err != nil {
		return nil, err
	}

	query := url.Values{"component": {componentID}}
	for _, path := range paths {
		query.Add("path", path)
	}
	endpoint := fmt.Sprintf("/stacks/%s/backups/%s/download?%s",
		url.PathEscape(stackname), url.PathEscape(backupID), query.Encode())

	headers, err := s.headersFor(ctx, srv, stackname)
	if err != nil {
		return nil, err
	}
	resp, err := s.agentSvc.MakeStreamRequestWithHeaders(ctx, srv, "GET", endpoint, headers)
	if err != nil {
		return nil, fmt.Errorf("failed to communicate with agent: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusOK:
		resp.Body = &storageReadCloser{ReadCloser: resp.Body, release: release}
		held = false
		return resp, nil
	case http.StatusNotFound:
		_ = resp.Body.Close()
		return nil, ErrBackupNotFound
	case http.StatusConflict:
		_ = resp.Body.Close()
		return nil, ErrRepositoryBusy
	default:
		defer func() { _ = resp.Body.Close() }()
		return nil, s.handleAgentError(resp)
	}
}

type agentOverview struct {
	Configured bool                 `json:"configured"`
	Stacks     []StackBackupSummary `json:"stacks"`
}

func (s *Service) serverOverview(ctx context.Context, p authz.Principal, serverID uint) (ServerBackups, bool) {
	entry := ServerBackups{ServerID: serverID, Stacks: []StackBackupSummary{}}

	srv, err := s.serverSvc.GetActiveServerForUser(ctx, serverID, p)
	if err != nil {
		if errors.Is(err, server.ErrServerInactive) || errors.Is(err, gorm.ErrRecordNotFound) {
			return entry, false
		}
		entry.Error = "this server could not be reached"
		return entry, true
	}
	entry.ServerName = srv.Name
	entry.Enabled = srv.BackupsEnabled

	resp, err := s.agentSvc.MakeRequest(ctx, srv, "GET", "/backups", nil)
	if err != nil {
		entry.Error = "the agent could not be reached"
		return entry, true
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		entry.Error = fmt.Sprintf("the agent returned status %d", resp.StatusCode)
		return entry, true
	}

	var overview agentOverview
	if err := json.NewDecoder(resp.Body).Decode(&overview); err != nil {
		entry.Error = "the agent returned a response that could not be read"
		return entry, true
	}

	entry.Configured = overview.Configured
	for _, stack := range overview.Stacks {
		allowed, err := s.authzSvc.HasStackPermission(p, serverID, stack.StackName, permnames.BackupsRead)
		if err != nil || !allowed {
			continue
		}
		entry.Stacks = append(entry.Stacks, stack)
	}
	return entry, true
}

func (s *Service) ListAllBackups(ctx context.Context, p authz.Principal, scope authz.ScopeSet) (*OverviewResponse, error) {
	overview := &OverviewResponse{Servers: []ServerBackups{}}

	for _, serverID := range scope.ServerIDs() {
		allowed, err := s.authzSvc.HasServerPermission(p, serverID, permnames.BackupsRead)
		if err != nil {
			return nil, fmt.Errorf("failed to verify permission: %w", err)
		}
		if !allowed {
			continue
		}
		entry, present := s.serverOverview(ctx, p, serverID)
		if !present {
			continue
		}
		overview.Servers = append(overview.Servers, entry)
	}

	return overview, nil
}
