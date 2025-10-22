package server

import (
	"berth/internal/common"
	"berth/internal/security"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/inertia"
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
