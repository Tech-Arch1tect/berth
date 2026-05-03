package maintenance

import (
	"net/http"

	"berth/internal/domain/rbac"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"

	"berth/internal/platform/inertia"
	"berth/internal/platform/inertia/errpage"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
)

type Handler struct {
	inertiaSvc *inertia.Service
	errPage    *errpage.Renderer
	service    *Service
}

func NewHandler(inertiaSvc *inertia.Service, service *Service) *Handler {
	return &Handler{
		inertiaSvc: inertiaSvc,
		errPage:    errpage.New(inertiaSvc),
		service:    service,
	}
}

func (h *Handler) ShowMaintenance(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	server, err := h.service.serverSvc.GetActiveServerForUser(ctx, serverID, userID)
	if err != nil {
		return h.errPage.Render(c, http.StatusNotFound, "Server not found")
	}

	hasPermission, err := h.service.rbacSvc.UserHasAnyStackPermission(ctx, userID, serverID, rbac.PermDockerMaintenanceRead)
	if err != nil {
		return h.errPage.Render(c, http.StatusInternalServerError, "Failed to check permissions")
	}

	if !hasPermission {
		return h.errPage.Render(c, http.StatusForbidden, "Insufficient permissions")
	}

	return h.inertiaSvc.Render(c, "Servers/Maintenance", gonertia.Props{
		"title":    "Docker Maintenance - " + server.Name,
		"server":   server,
		"serverid": serverID,
	})
}
