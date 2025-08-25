package stack

import (
	"net/http"
	"strconv"

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

func (h *Handler) ShowServerStacks(c echo.Context) error {

	serverIDStr := c.Param("id")
	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid server ID")
	}

	serverInfo, err := h.service.GetServerInfo(uint(serverID))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Server not found")
	}

	return h.inertiaSvc.Render(c, "Servers/Stacks", gonertia.Props{
		"title":    serverInfo.Name + " - Stacks",
		"server":   serverInfo,
		"serverId": uint(serverID),
	})
}

func (h *Handler) ShowStackDetails(c echo.Context) error {
	serverIDStr := c.Param("serverid")
	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid server ID")
	}

	stackName := c.Param("stackname")
	if stackName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Stack name is required")
	}

	serverInfo, err := h.service.GetServerInfo(uint(serverID))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Server not found")
	}

	return h.inertiaSvc.Render(c, "Servers/StackDetails", gonertia.Props{
		"title":     serverInfo.Name + " - " + stackName,
		"server":    serverInfo,
		"serverId":  uint(serverID),
		"stackName": stackName,
	})
}
