package server

import (
	"net/http"

	"berth/internal/domain/security"
	"berth/internal/platform/inertia"
	"berth/internal/platform/inertia/errpage"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type Handler struct {
	db         *gorm.DB
	service    *Service
	inertiaSvc *inertia.Service
	errPage    *errpage.Renderer
	auditSvc   *security.AuditService
}

func NewHandler(db *gorm.DB, service *Service, inertiaSvc *inertia.Service, auditSvc *security.AuditService) *Handler {
	return &Handler{
		db:         db,
		service:    service,
		inertiaSvc: inertiaSvc,
		errPage:    errpage.New(inertiaSvc),
		auditSvc:   auditSvc,
	}
}

func (h *Handler) Index(c echo.Context) error {
	servers, err := h.service.ListServers()
	if err != nil {
		return h.errPage.Render(c, http.StatusInternalServerError, "Failed to fetch servers")
	}

	return h.inertiaSvc.Render(c, "Admin/Servers", map[string]any{
		"servers": servers,
	})
}
