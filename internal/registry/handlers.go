package registry

import (
	"berth/internal/common"
	"berth/internal/rbac"
	"berth/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
)

type Handler struct {
	service    *Service
	rbacSvc    *rbac.Service
	inertiaSvc *inertia.Service
}

func NewHandler(service *Service, rbacSvc *rbac.Service, inertiaSvc *inertia.Service) *Handler {
	return &Handler{
		service:    service,
		rbacSvc:    rbacSvc,
		inertiaSvc: inertiaSvc,
	}
}

func (h *Handler) ShowRegistries(c echo.Context) error {
	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)

	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(userID, serverID, "registries.manage")
	if err != nil {
		return h.inertiaSvc.Render(c, "Errors/Generic", map[string]any{
			"title":   "Error",
			"message": "Failed to check permissions",
		})
	}

	if !hasPermission {
		return h.inertiaSvc.Render(c, "Errors/Generic", map[string]any{
			"title":   "Access Denied",
			"message": "You don't have permission to manage registry credentials for this server",
		})
	}

	var server struct {
		ID   uint   `json:"id"`
		Name string `json:"name"`
	}

	server.ID = serverID

	credentials, err := h.service.GetCredentials(serverID)
	if err != nil {
		credentials = []models.ServerRegistryCredential{}
	}

	return h.inertiaSvc.Render(c, "Servers/Registries", map[string]any{
		"title":       "Registry Credentials",
		"server_id":   serverID,
		"server_name": server.Name,
		"credentials": credentials,
	})
}
