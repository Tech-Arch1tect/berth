package registry

import (
	"berth/internal/common"
	"berth/internal/rbac"
	"berth/models"
	"encoding/json"
	"errors"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type APIHandler struct {
	service *Service
	rbacSvc *rbac.Service
	db      *gorm.DB
}

func NewAPIHandler(service *Service, rbacSvc *rbac.Service, db *gorm.DB) *APIHandler {
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
	serverID, err := common.ParseUintParam(c, "server_id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(userID, serverID, "registries.manage")
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return common.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	credentials, err := h.service.GetCredentials(serverID)
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch registry credentials")
	}

	return common.SendSuccess(c, map[string]any{
		"credentials": credentials,
	})
}

func (h *APIHandler) GetCredential(c echo.Context) error {
	serverID, err := common.ParseUintParam(c, "server_id")
	if err != nil {
		return err
	}

	credID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(userID, serverID, "registries.manage")
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return common.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	credential, err := h.service.GetCredential(credID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.SendNotFound(c, "Registry credential not found")
		}
		return common.SendInternalError(c, "Failed to fetch registry credential")
	}

	if credential.ServerID != serverID {
		return common.SendNotFound(c, "Registry credential not found")
	}

	return common.SendSuccess(c, map[string]any{
		"credential": credential,
	})
}

func (h *APIHandler) CreateCredential(c echo.Context) error {
	serverID, err := common.ParseUintParam(c, "server_id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(userID, serverID, "registries.manage")
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return common.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	var req CreateCredentialRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	if req.StackPattern == "" {
		req.StackPattern = "*"
	}

	if req.RegistryURL == "" || req.Username == "" || req.Password == "" {
		return common.SendBadRequest(c, "registry_url, username, and password are required")
	}

	credential, err := h.service.CreateCredential(serverID, req.StackPattern, req.RegistryURL, req.ImagePattern, req.Username, req.Password)
	if err != nil {
		return common.SendBadRequest(c, err.Error())
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

	return common.SendCreated(c, map[string]any{
		"credential": credential,
	})
}

func (h *APIHandler) UpdateCredential(c echo.Context) error {
	serverID, err := common.ParseUintParam(c, "server_id")
	if err != nil {
		return err
	}

	credID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(userID, serverID, "registries.manage")
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return common.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	existing, err := h.service.GetCredential(credID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.SendNotFound(c, "Registry credential not found")
		}
		return common.SendInternalError(c, "Failed to fetch registry credential")
	}

	if existing.ServerID != serverID {
		return common.SendNotFound(c, "Registry credential not found")
	}

	var req UpdateCredentialRequest
	if err := common.BindRequest(c, &req); err != nil {
		return err
	}

	credential, err := h.service.UpdateCredential(credID, req.StackPattern, req.RegistryURL, req.ImagePattern, req.Username, req.Password)
	if err != nil {
		return common.SendBadRequest(c, err.Error())
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

	return common.SendSuccess(c, map[string]any{
		"credential": credential,
	})
}

func (h *APIHandler) DeleteCredential(c echo.Context) error {
	serverID, err := common.ParseUintParam(c, "server_id")
	if err != nil {
		return err
	}

	credID, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(userID, serverID, "registries.manage")
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}
	if !hasPermission {
		return common.SendForbidden(c, "Insufficient permissions to manage registry credentials")
	}

	existing, err := h.service.GetCredential(credID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.SendNotFound(c, "Registry credential not found")
		}
		return common.SendInternalError(c, "Failed to fetch registry credential")
	}

	if existing.ServerID != serverID {
		return common.SendNotFound(c, "Registry credential not found")
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

		return common.SendInternalError(c, "Failed to delete registry credential")
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

	return common.SendSuccess(c, map[string]any{
		"message": "Registry credential deleted successfully",
	})
}
