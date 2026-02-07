package maintenance

import (
	"berth/internal/common"
	"berth/internal/rbac"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
)

type Handler struct {
	inertiaSvc *inertia.Service
	service    *Service
}

func NewHandler(inertiaSvc *inertia.Service, service *Service) *Handler {
	return &Handler{
		inertiaSvc: inertiaSvc,
		service:    service,
	}
}

func (h *Handler) ShowMaintenance(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := common.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	server, err := h.service.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	hasPermission, err := h.service.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermDockerMaintenanceRead)
	if err != nil {
		return common.SendInternalError(c, "Failed to check permissions")
	}

	if !hasPermission {
		return common.SendForbidden(c, "Insufficient permissions")
	}

	return h.inertiaSvc.Render(c, "Servers/Maintenance", gonertia.Props{
		"title":    "Docker Maintenance - " + server.Name,
		"server":   server,
		"serverid": serverID,
	})
}
