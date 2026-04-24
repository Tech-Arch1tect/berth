package stack

import (
	"context"
	"strconv"

	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/rbac"
	"berth/models"

	"berth/internal/platform/inertia"
	"berth/internal/session"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
)

type serverLister interface {
	ListServersForUser(ctx context.Context, userID uint) ([]models.ServerInfo, error)
}

type Handler struct {
	inertiaSvc *inertia.Service
	service    *Service
	rbacSvc    *rbac.Service
	serverSvc  serverLister
}

func NewHandler(inertiaSvc *inertia.Service, service *Service, rbacSvc *rbac.Service, serverSvc serverLister) *Handler {
	return &Handler{
		inertiaSvc: inertiaSvc,
		service:    service,
		rbacSvc:    rbacSvc,
		serverSvc:  serverSvc,
	}
}

func (h *Handler) Index(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()
	servers, err := h.serverSvc.ListServersForUser(ctx, userID)
	if err != nil {
		return err
	}

	return h.inertiaSvc.Render(c, "Stacks", gonertia.Props{
		"title":   "All Stacks",
		"servers": servers,
	})
}

func (h *Handler) ShowServerStacks(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverIDStr := c.Param("id")
	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return response.SendBadRequest(c, "Invalid server ID")
	}

	ctx := c.Request().Context()
	_, err = h.service.serverSvc.GetActiveServerForUser(ctx, uint(serverID), userID)
	if err != nil {
		return response.SendNotFound(c, "Server not found")
	}

	serverInfo, err := h.service.GetServerInfo(uint(serverID))
	if err != nil {
		return response.SendNotFound(c, "Server not found")
	}

	return h.inertiaSvc.Render(c, "Servers/Stacks", gonertia.Props{
		"title":    serverInfo.Name + " - Stacks",
		"server":   serverInfo,
		"serverid": uint(serverID),
	})
}

func (h *Handler) ShowStackDetails(c echo.Context) error {
	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	if serverID == 0 || stackname == "" {
		return response.SendBadRequest(c, "Invalid server ID or stack name")
	}

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()

	_, err = h.service.serverSvc.GetActiveServerForUser(ctx, uint(serverID), userID)
	if err != nil {
		return response.SendNotFound(c, "Server not found")
	}

	serverInfo, err := h.service.GetServerInfo(uint(serverID))
	if err != nil {
		return response.SendNotFound(c, "Server not found")
	}

	permissions, err := h.rbacSvc.GetUserStackPermissions(ctx, userID, uint(serverID), stackname)
	if err != nil {
		return response.SendInternalError(c, "Failed to get user permissions")
	}

	return h.inertiaSvc.Render(c, "Servers/StackDetails", gonertia.Props{
		"title":       serverInfo.Name + " - " + stackname,
		"server":      serverInfo,
		"serverid":    uint(serverID),
		"stackname":   stackname,
		"permissions": permissions,
	})
}
