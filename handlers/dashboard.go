package handlers

import (
	"brx-starter-kit/models"
	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	inertiaSvc *inertia.Service
	db         *gorm.DB
	logger     *logging.Service
}

func NewDashboardHandler(inertiaSvc *inertia.Service, db *gorm.DB, logger *logging.Service) *DashboardHandler {
	return &DashboardHandler{
		inertiaSvc: inertiaSvc,
		db:         db,
		logger:     logger,
	}
}

func (h *DashboardHandler) Dashboard(c echo.Context) error {
	h.logger.Info("dashboard accessed",
		zap.String("user_agent", c.Request().UserAgent()),
		zap.String("remote_ip", c.RealIP()),
	)

	var servers []models.ServerResponse
	result := h.db.Model(&models.Server{}).Find(&servers)
	if result.Error != nil {
		h.logger.Error("failed to fetch servers",
			zap.Error(result.Error),
		)
		return result.Error
	}

	h.logger.Info("dashboard data retrieved",
		zap.Int("server_count", len(servers)),
	)

	return h.inertiaSvc.Render(c, "Dashboard", gonertia.Props{
		"title":   "Dashboard",
		"servers": servers,
	})
}
