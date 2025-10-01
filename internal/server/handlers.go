package server

import (
	"berth/internal/common"
	"berth/internal/security"
	"berth/models"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

type Handler struct {
	db         *gorm.DB
	service    *Service
	inertiaSvc *inertia.Service
	auditSvc   *security.AuditService
}

func NewHandler(db *gorm.DB, service *Service, inertiaSvc *inertia.Service, auditSvc *security.AuditService) *Handler {
	return &Handler{
		db:         db,
		service:    service,
		inertiaSvc: inertiaSvc,
		auditSvc:   auditSvc,
	}
}

func (h *Handler) Index(c echo.Context) error {
	servers, err := h.service.ListServers()
	if err != nil {
		return common.SendInternalError(c, "Failed to fetch servers")
	}

	return h.inertiaSvc.Render(c, "Admin/Servers", map[string]any{
		"servers": servers,
	})
}

func (h *Handler) Show(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	server, err := h.service.GetServerResponse(uint(id))
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	return common.SendSuccess(c, server)
}

func (h *Handler) Store(c echo.Context) error {
	var server models.Server
	if err := common.BindRequest(c, &server); err != nil {
		session.AddFlashError(c, "Invalid request data")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	if err := h.service.CreateServer(&server); err != nil {
		session.AddFlashError(c, "Failed to create server")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogServerEvent(
			security.EventServerCreated,
			actorUser.ID,
			actorUser.Username,
			server.ID,
			server.Name,
			c.RealIP(),
			true,
			"",
			map[string]any{
				"host": server.Host,
				"port": server.Port,
			},
		)
	}

	session.AddFlashSuccess(c, "Server created successfully")
	return h.inertiaSvc.Redirect(c, "/admin/servers")
}

func (h *Handler) Update(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		session.AddFlashError(c, "Invalid server ID")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	var updates models.Server
	if err := common.BindRequest(c, &updates); err != nil {
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

	server, err := h.service.UpdateServer(uint(id), &updates)
	if err != nil {
		session.AddFlashError(c, "Failed to update server")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogServerEvent(
			security.EventServerUpdated,
			actorUser.ID,
			actorUser.Username,
			server.ID,
			server.Name,
			c.RealIP(),
			true,
			"",
			map[string]any{
				"host": server.Host,
				"port": server.Port,
			},
		)
	}

	session.AddFlashSuccess(c, "Server updated successfully")
	return h.inertiaSvc.Redirect(c, "/admin/servers")
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		session.AddFlashError(c, "Invalid server ID")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	server, err := h.service.GetServer(uint(id))
	if err != nil {
		session.AddFlashError(c, "Server not found")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	if err := h.service.DeleteServer(uint(id)); err != nil {
		session.AddFlashError(c, "Failed to delete server")
		return h.inertiaSvc.Redirect(c, "/admin/servers")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	if err := h.db.First(&actorUser, actorUserID).Error; err == nil {
		_ = h.auditSvc.LogServerEvent(
			security.EventServerDeleted,
			actorUser.ID,
			actorUser.Username,
			server.ID,
			server.Name,
			c.RealIP(),
			true,
			"",
			nil,
		)
	}

	session.AddFlashSuccess(c, "Server deleted successfully")
	return h.inertiaSvc.Redirect(c, "/admin/servers")
}

func (h *Handler) TestConnection(c echo.Context) error {
	id, err := common.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	server, err := h.service.GetServer(uint(id))
	if err != nil {
		return common.SendNotFound(c, "Server not found")
	}

	actorUserID := session.GetUserIDAsUint(c)
	var actorUser models.User
	h.db.First(&actorUser, actorUserID)

	if err := h.service.TestServerConnection(server); err != nil {
		if actorUser.ID > 0 {
			_ = h.auditSvc.LogServerEvent(
				security.EventServerConnectionTestFailure,
				actorUser.ID,
				actorUser.Username,
				server.ID,
				server.Name,
				c.RealIP(),
				false,
				err.Error(),
				nil,
			)
		}
		return common.SendError(c, http.StatusServiceUnavailable, "Connection test failed: "+err.Error())
	}

	if actorUser.ID > 0 {
		_ = h.auditSvc.LogServerEvent(
			security.EventServerConnectionTestSuccess,
			actorUser.ID,
			actorUser.Username,
			server.ID,
			server.Name,
			c.RealIP(),
			true,
			"",
			nil,
		)
	}

	return common.SendMessage(c, "Connection successful")
}
