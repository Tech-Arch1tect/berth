package registry

import (
	"berth/internal/domain/rbac"
	"berth/internal/domain/server"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"

	"berth/internal/domain/session"
	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	service    *Service
	rbacSvc    *rbac.Service
	serverSvc  *server.Service
	inertiaSvc *inertia.Service
}

func NewHandler(service *Service, rbacSvc *rbac.Service, serverSvc *server.Service, inertiaSvc *inertia.Service) *Handler {
	return &Handler{
		service:    service,
		rbacSvc:    rbacSvc,
		serverSvc:  serverSvc,
		inertiaSvc: inertiaSvc,
	}
}

func (h *Handler) ShowRegistries(c echo.Context) error {
	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()

	srv, err := h.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return response.SendNotFound(c, "Server not found")
	}
	hasPermission, err := h.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermRegistriesManage)
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

	credentials, err := h.service.GetCredentials(serverID)
	if err != nil {
		credentials = []server.ServerRegistryCredential{}
	}

	return h.inertiaSvc.Render(c, "Servers/Registries", map[string]any{
		"title":       "Registry Credentials - " + srv.Name,
		"server_id":   serverID,
		"server_name": srv.Name,
		"credentials": credentials,
	})
}
