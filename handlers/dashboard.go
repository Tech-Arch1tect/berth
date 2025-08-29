package handlers

import (
	"berth/internal/server"
	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	inertiaSvc *inertia.Service
	db         *gorm.DB
	logger     *logging.Service
	serverSvc  *server.Service
}

func NewDashboardHandler(inertiaSvc *inertia.Service, db *gorm.DB, logger *logging.Service, serverSvc *server.Service) *DashboardHandler {
	return &DashboardHandler{
		inertiaSvc: inertiaSvc,
		db:         db,
		logger:     logger,
		serverSvc:  serverSvc,
	}
}

func (h *DashboardHandler) Dashboard(c echo.Context) error {
	h.logger.Info("dashboard accessed",
		zap.String("user_agent", c.Request().UserAgent()),
		zap.String("remote_ip", c.RealIP()),
	)

	userID := session.GetUserIDAsUint(c)
	servers, err := h.serverSvc.ListServersForUser(userID)
	if err != nil {
		h.logger.Error("failed to fetch servers",
			zap.Error(err),
		)
		return err
	}

	h.logger.Info("dashboard data retrieved",
		zap.Int("server_count", len(servers)),
	)

	return h.inertiaSvc.Render(c, "Dashboard", gonertia.Props{
		"title":   "Dashboard",
		"servers": servers,
	})
}
