package server

import (
	"brx-starter-kit/models"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
)

type Handler struct {
	service    *Service
	inertiaSvc *inertia.Service
}

func NewHandler(service *Service, inertiaSvc *inertia.Service) *Handler {
	return &Handler{
		service:    service,
		inertiaSvc: inertiaSvc,
	}
}

func (h *Handler) Index(c echo.Context) error {
	servers, err := h.service.ListServers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch servers"})
	}

	return h.inertiaSvc.Render(c, "Admin/Servers", map[string]any{
		"servers": servers,
	})
}

func (h *Handler) Show(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid server ID"})
	}

	server, err := h.service.GetServer(uint(id))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Server not found"})
	}

	return c.JSON(http.StatusOK, server)
}

func (h *Handler) Store(c echo.Context) error {
	var server models.Server
	if err := c.Bind(&server); err != nil {
		session.AddFlashError(c, "Invalid request data")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	if err := h.service.CreateServer(&server); err != nil {
		session.AddFlashError(c, "Failed to create server")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	session.AddFlashSuccess(c, "Server created successfully")
	return h.inertiaSvc.Redirect(c, "/admin/servers")
}

func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		session.AddFlashError(c, "Invalid server ID")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	var updates models.Server
	if err := c.Bind(&updates); err != nil {
		session.AddFlashError(c, "Invalid request data")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	// If access_token is empty, don't update it (keep existing)
	if updates.AccessToken == "" {
		existing, err := h.service.GetServer(uint(id))
		if err != nil {
			session.AddFlashError(c, "Server not found")
			return h.inertiaSvc.Redirect(c, "/admin/servers")
		}
		updates.AccessToken = existing.AccessToken
	}

	_, err = h.service.UpdateServer(uint(id), &updates)
	if err != nil {
		session.AddFlashError(c, "Failed to update server")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	session.AddFlashSuccess(c, "Server updated successfully")
	return h.inertiaSvc.Redirect(c, "/admin/servers")
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		session.AddFlashError(c, "Invalid server ID")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	if err := h.service.DeleteServer(uint(id)); err != nil {
		session.AddFlashError(c, "Failed to delete server")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	session.AddFlashSuccess(c, "Server deleted successfully")
	return h.inertiaSvc.Redirect(c, "/admin/servers")
}

func (h *Handler) TestConnection(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid server ID"})
	}

	server, err := h.service.GetServer(uint(id))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Server not found"})
	}

	if err := h.service.TestServerConnection(server); err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error":   "Connection test failed",
			"details": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "Connection successful"})
}
