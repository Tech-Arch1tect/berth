package operations

import (
	"errors"
	"time"

	"berth/internal/domain/authz"
	"berth/internal/domain/backups"
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
)

type backupSecurityAuditor interface {
	LogBackupEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, stackName string, backupID string, ip string, metadata map[string]any) error
}

type Handler struct {
	service     *Service
	securityLog backupSecurityAuditor
}

func NewHandler(service *Service, securityLog backupSecurityAuditor) *Handler {
	return &Handler{
		service:     service,
		securityLog: securityLog,
	}
}

func backupSecurityEvent(command string) (string, bool) {
	switch command {
	case "create-backup":
		return security.EventBackupCreated, true
	case "restore-backup":
		return security.EventBackupRestored, true
	default:
		return "", false
	}
}

func backupIDFromOptions(options []string) string {
	for i, option := range options {
		if option == "--backup-id" && i+1 < len(options) {
			return options[i+1]
		}
	}
	return ""
}

func backupEventMetadata(command string, options []string, operationID, stackname string, serverID uint) map[string]any {
	metadata := map[string]any{
		"operation_id": operationID,
		"stack":        stackname,
		"server_id":    serverID,
	}
	if command == "create-backup" {
		stopMode := "none"
		for _, option := range options {
			if option == "--stop" {
				stopMode = "stop"
			}
			if option == "--pause" {
				stopMode = "pause"
			}
		}
		metadata["stack_state_during_backup"] = stopMode
		return metadata
	}

	metadata["backup_id"] = backupIDFromOptions(options)
	var components []string
	exactState := true
	for i := 0; i < len(options); i++ {
		if options[i] == "--component" && i+1 < len(options) {
			i++
			components = append(components, options[i])
		}
		if options[i] == "--keep-extra-files" {
			exactState = false
		}
	}
	if len(components) == 0 {
		metadata["components"] = "all"
	} else {
		metadata["components"] = components
	}
	metadata["exact_snapshot_state"] = exactState
	return metadata
}

func (h *Handler) StartOperation(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	stackname := c.Param("stackname")
	if stackname == "" {
		return response.BadRequest(c, "Stack name is required")
	}

	var req OperationRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	resp, err := h.service.StartOperation(c.Request().Context(), p, serverID, stackname, req)
	if err != nil {
		if errors.Is(err, backups.ErrBackupsNotEnabled) {
			return response.Conflict(c, err.Error())
		}
		return response.Internal(c, err.Error())
	}

	startTime := time.Now()
	h.service.auditSvc.LogOperationStart(p.UserID(), serverID, stackname, resp.OperationID, req, startTime)

	if eventType, isBackup := backupSecurityEvent(req.Command); isBackup {
		_ = h.securityLog.LogBackupEvent(
			eventType,
			p.UserID(),
			session.ResolveUsername(c),
			serverID,
			stackname,
			backupIDFromOptions(req.Options),
			c.RealIP(),
			backupEventMetadata(req.Command, req.Options, resp.OperationID, stackname, serverID),
		)
	}

	return response.OK(c, *resp)
}
