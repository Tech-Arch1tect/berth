package operations

import (
	"errors"
	"time"

	"berth/internal/domain/authz"
	"berth/internal/domain/backups"
	"berth/internal/domain/server"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
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
		label := ""
		for i := 0; i < len(options); i++ {
			if options[i] == "--stop" {
				stopMode = "stop"
			}
			if options[i] == "--pause" {
				stopMode = "pause"
			}
			if options[i] == "--label" && i+1 < len(options) {
				i++
				label = options[i]
			}
		}
		metadata["stack_state_during_backup"] = stopMode
		if label != "" {
			metadata["backup_label"] = label
		}
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

func newBackupAuditContext(command string, options, services []string, operationID string, actorUserID uint, actorUsername, actorIP, actorUserAgent string, serverID uint, stackName string) *backupAuditContext {
	if !isBackupCommand(command) {
		return nil
	}
	safeOptions := operationLogFields(OperationRequest{Command: command, Options: options, Services: services}).Options
	metadata := backupEventMetadata(command, safeOptions, operationID, stackName, serverID)
	for key, value := range metadata {
		if values, ok := value.([]string); ok {
			metadata[key] = append([]string(nil), values...)
		}
	}
	return &backupAuditContext{
		Command:        command,
		OperationID:    operationID,
		ActorUserID:    actorUserID,
		ActorUsername:  actorUsername,
		ActorIP:        actorIP,
		ActorUserAgent: actorUserAgent,
		ServerID:       serverID,
		StackName:      stackName,
		BackupID:       backupIDFromOptions(safeOptions),
		Metadata:       metadata,
	}
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
		switch {
		case errors.Is(err, backups.ErrBackupsNotEnabled), errors.Is(err, backups.ErrRepositoryBusy):
			return response.Conflict(c, err.Error())
		case errors.Is(err, server.ErrBackupStorageUnavailable):
			return response.ServiceUnavailable(c, err.Error())
		default:
			return response.Internal(c, err.Error())
		}
	}

	startTime := time.Now()
	backupCtx := newBackupAuditContext(
		req.Command,
		req.Options,
		req.Services,
		resp.OperationID,
		p.UserID(),
		session.ResolveUsername(c),
		c.RealIP(),
		c.Request().UserAgent(),
		serverID,
		stackname,
	)
	h.service.RecordStartAndPersist(p, serverID, stackname, resp.OperationID, req, startTime, backupCtx)

	return response.OK(c, *resp)
}
