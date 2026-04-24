package registry

import (
	"berth/internal/domain/rbac"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"
	"berth/models"
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"berth/internal/domain/session"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type permissionChecker interface {
	UserHasAnyStackPermission(ctx context.Context, userID, serverID uint, permissionName string) (bool, error)
}

type APIHandler struct {
	service *Service
	rbacSvc permissionChecker
	db      *gorm.DB
}

func NewAPIHandler(service *Service, rbacSvc permissionChecker, db *gorm.DB) *APIHandler {
	return &APIHandler{
		service: service,
		rbacSvc: rbacSvc,
		db:      db,
	}
}

type CreateCredentialRequest struct {
	StackPattern string `json:"stack_pattern"`
	RegistryURL  string `json:"registry_url"`
	ImagePattern string `json:"image_pattern"`
	Username     string `json:"username"`
	Password     string `json:"password"`
}

type UpdateCredentialRequest struct {
	StackPattern string `json:"stack_pattern"`
	RegistryURL  string `json:"registry_url"`
	ImagePattern string `json:"image_pattern"`
	Username     string `json:"username"`
	Password     string `json:"password"`
}

func (h *APIHandler) ListCredentials(c echo.Context) error {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermRegistriesManage)
	if err != nil {
		return response.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return response.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	credentials, err := h.service.GetCredentials(serverID)
	if err != nil {
		return response.SendInternalError(c, "Failed to fetch registry credentials")
	}

	return c.JSON(http.StatusOK, ListCredentialsResponse{
		Success: true,
		Data: ListCredentialsData{
			Credentials: ToResponseList(credentials),
		},
	})
}

func (h *APIHandler) GetCredential(c echo.Context) error {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	credID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermRegistriesManage)
	if err != nil {
		return response.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return response.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	credential, err := h.service.GetCredential(credID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.SendNotFound(c, "Registry credential not found")
		}
		return response.SendInternalError(c, "Failed to fetch registry credential")
	}

	if credential.ServerID != serverID {
		return response.SendNotFound(c, "Registry credential not found")
	}

	return c.JSON(http.StatusOK, GetCredentialResponse{
		Success: true,
		Data: GetCredentialData{
			Credential: ToResponse(credential),
		},
	})
}

func (h *APIHandler) CreateCredential(c echo.Context) error {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermRegistriesManage)
	if err != nil {
		return response.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return response.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	var req CreateCredentialRequest
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	if req.StackPattern == "" {
		req.StackPattern = "*"
	}

	if req.RegistryURL == "" || req.Username == "" || req.Password == "" {
		return response.SendBadRequest(c, "registry_url, username, and password are required")
	}

	credential, err := h.service.CreateCredential(serverID, req.StackPattern, req.RegistryURL, req.ImagePattern, req.Username, req.Password)
	if err != nil {
		return response.SendBadRequest(c, err.Error())
	}

	h.service.Logger().Info("registry credential created",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.Uint("credential_id", credential.ID),
		zap.String("registry_url", credential.RegistryURL),
		zap.String("stack_pattern", credential.StackPattern),
		zap.String("username", credential.Username),
	)

	metadataJSON, _ := json.Marshal(map[string]any{
		"registry_url":  credential.RegistryURL,
		"stack_pattern": credential.StackPattern,
		"username":      credential.Username,
		"image_pattern": credential.ImagePattern,
	})

	auditLog := &models.SecurityAuditLog{
		EventType:      "registry_credential_created",
		EventCategory:  models.CategoryRegistry,
		Severity:       models.SeverityMedium,
		ActorUserID:    &userID,
		ActorIP:        c.RealIP(),
		ActorUserAgent: c.Request().UserAgent(),
		TargetType:     models.TargetTypeRegistryCredential,
		TargetID:       &credential.ID,
		TargetName:     credential.RegistryURL,
		Success:        true,
		Metadata:       string(metadataJSON),
		ServerID:       &serverID,
	}
	h.db.Create(auditLog)

	return c.JSON(http.StatusCreated, CreateCredentialResponse{
		Success: true,
		Data: GetCredentialData{
			Credential: ToResponse(credential),
		},
	})
}

func (h *APIHandler) UpdateCredential(c echo.Context) error {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	credID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermRegistriesManage)
	if err != nil {
		return response.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return response.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	existing, err := h.service.GetCredential(credID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.SendNotFound(c, "Registry credential not found")
		}
		return response.SendInternalError(c, "Failed to fetch registry credential")
	}

	if existing.ServerID != serverID {
		return response.SendNotFound(c, "Registry credential not found")
	}

	var req UpdateCredentialRequest
	if err := validation.BindRequest(c, &req); err != nil {
		return err
	}

	credential, err := h.service.UpdateCredential(credID, req.StackPattern, req.RegistryURL, req.ImagePattern, req.Username, req.Password)
	if err != nil {
		return response.SendBadRequest(c, err.Error())
	}

	h.service.Logger().Info("registry credential updated",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.Uint("credential_id", credID),
		zap.String("registry_url", credential.RegistryURL),
		zap.String("stack_pattern", credential.StackPattern),
		zap.String("username", credential.Username),
	)

	metadataJSON, _ := json.Marshal(map[string]any{
		"registry_url":  credential.RegistryURL,
		"stack_pattern": credential.StackPattern,
		"username":      credential.Username,
		"image_pattern": credential.ImagePattern,
	})

	auditLog := &models.SecurityAuditLog{
		EventType:      "registry_credential_updated",
		EventCategory:  models.CategoryRegistry,
		Severity:       models.SeverityMedium,
		ActorUserID:    &userID,
		ActorIP:        c.RealIP(),
		ActorUserAgent: c.Request().UserAgent(),
		TargetType:     models.TargetTypeRegistryCredential,
		TargetID:       &credID,
		TargetName:     credential.RegistryURL,
		Success:        true,
		Metadata:       string(metadataJSON),
		ServerID:       &serverID,
	}
	h.db.Create(auditLog)

	return c.JSON(http.StatusOK, UpdateCredentialResponse{
		Success: true,
		Data: GetCredentialData{
			Credential: ToResponse(credential),
		},
	})
}

func (h *APIHandler) DeleteCredential(c echo.Context) error {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	credID, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermRegistriesManage)
	if err != nil {
		return response.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return response.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	existing, err := h.service.GetCredential(credID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.SendNotFound(c, "Registry credential not found")
		}
		return response.SendInternalError(c, "Failed to fetch registry credential")
	}

	if existing.ServerID != serverID {
		return response.SendNotFound(c, "Registry credential not found")
	}

	h.service.Logger().Info("registry credential deleted",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.Uint("credential_id", credID),
		zap.String("registry_url", existing.RegistryURL),
		zap.String("stack_pattern", existing.StackPattern),
		zap.String("username", existing.Username),
	)

	if err := h.service.DeleteCredential(credID); err != nil {
		metadataJSON, _ := json.Marshal(map[string]any{
			"registry_url":  existing.RegistryURL,
			"stack_pattern": existing.StackPattern,
			"username":      existing.Username,
			"error":         err.Error(),
		})

		auditLog := &models.SecurityAuditLog{
			EventType:      "registry_credential_deleted",
			EventCategory:  models.CategoryRegistry,
			Severity:       models.SeverityMedium,
			ActorUserID:    &userID,
			ActorIP:        c.RealIP(),
			ActorUserAgent: c.Request().UserAgent(),
			TargetType:     models.TargetTypeRegistryCredential,
			TargetID:       &credID,
			TargetName:     existing.RegistryURL,
			Success:        false,
			FailureReason:  err.Error(),
			Metadata:       string(metadataJSON),
			ServerID:       &serverID,
		}
		h.db.Create(auditLog)

		return response.SendInternalError(c, "Failed to delete registry credential")
	}

	metadataJSON, _ := json.Marshal(map[string]any{
		"registry_url":  existing.RegistryURL,
		"stack_pattern": existing.StackPattern,
		"username":      existing.Username,
	})

	auditLog := &models.SecurityAuditLog{
		EventType:      "registry_credential_deleted",
		EventCategory:  models.CategoryRegistry,
		Severity:       models.SeverityMedium,
		ActorUserID:    &userID,
		ActorIP:        c.RealIP(),
		ActorUserAgent: c.Request().UserAgent(),
		TargetType:     models.TargetTypeRegistryCredential,
		TargetID:       &credID,
		TargetName:     existing.RegistryURL,
		Success:        true,
		Metadata:       string(metadataJSON),
		ServerID:       &serverID,
	}
	h.db.Create(auditLog)

	return c.JSON(http.StatusOK, DeleteCredentialResponse{
		Success: true,
		Data: DeleteCredentialMessageData{
			Message: "Registry credential deleted successfully",
		},
	})
}
