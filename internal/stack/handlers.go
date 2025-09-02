package stack

import (
	"strconv"

	"berth/internal/common"
	"berth/internal/rbac"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
)

type Handler struct {
	inertiaSvc *inertia.Service
	service    *Service
	rbacSvc    *rbac.Service
}

func NewHandler(inertiaSvc *inertia.Service, service *Service, rbacSvc *rbac.Service) *Handler {
	return &Handler{
		inertiaSvc: inertiaSvc,
		service:    service,
		rbacSvc:    rbacSvc,
	}
}

func (h *Handler) ShowServerStacks(c echo.Context) error {
	userID, err := common.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverIDStr := c.Param("id")
	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return common.SendBadRequest(c, "Invalid server ID")
	}

	_, err = h.service.serverSvc.GetActiveServerForUser(uint(serverID), userID)
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	serverInfo, err := h.service.GetServerInfo(uint(serverID))
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	return h.inertiaSvc.Render(c, "Servers/Stacks", gonertia.Props{
		"title":    serverInfo.Name + " - Stacks",
		"server":   serverInfo,
		"serverid": uint(serverID),
	})
}

func (h *Handler) ShowStackDetails(c echo.Context) error {
	serverID, stackname, err := common.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	if serverID == 0 || stackname == "" {
		return common.SendBadRequest(c, "Invalid server ID or stack name")
	}

	userID := session.GetUserIDAsUint(c)

	_, err = h.service.serverSvc.GetActiveServerForUser(uint(serverID), userID)
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	serverInfo, err := h.service.GetServerInfo(uint(serverID))
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	permissions, err := h.rbacSvc.GetUserStackPermissions(userID, uint(serverID), stackname)
	if err != nil {
		return common.SendInternalError(c, "Failed to get user permissions")
	}

	return h.inertiaSvc.Render(c, "Servers/StackDetails", gonertia.Props{
		"title":       serverInfo.Name + " - " + stackname,
		"server":      serverInfo,
		"serverid":    uint(serverID),
		"stackname":   stackname,
		"permissions": permissions,
	})
}
