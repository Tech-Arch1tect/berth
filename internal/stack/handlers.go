package stack

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
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
	userID := session.GetUserIDAsUint(c)

	serverIDStr := c.Param("id")
	serverID, err := strconv.ParseUint(serverIDStr, 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid server ID")
	}

	stacks, err := h.service.ListStacksForServer(c.Request().Context(), userID, uint(serverID))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	serverInfo, err := h.service.GetServerInfo(uint(serverID))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Server not found")
	}

	return h.inertiaSvc.Render(c, "Servers/Stacks", gonertia.Props{
		"title":  serverInfo.Name + " - Stacks",
		"server": serverInfo,
		"stacks": stacks,
	})
}
