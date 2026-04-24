package dashboard

import (
	"context"

	"berth/internal/domain/server"
	"berth/internal/domain/session"
	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type serverLister interface {
	ListServersForUser(ctx context.Context, userID uint) ([]server.ServerInfo, error)
}

type Handler struct {
	inertiaSvc *inertia.Service
	db         *gorm.DB
	logger     *zap.Logger
	serverSvc  serverLister
}

func NewHandler(inertiaSvc *inertia.Service, db *gorm.DB, logger *zap.Logger, serverSvc serverLister) *Handler {
	return &Handler{
		inertiaSvc: inertiaSvc,
		db:         db,
		logger:     logger,
		serverSvc:  serverSvc,
	}
}

func (h *Handler) Dashboard(c echo.Context) error {
	h.logger.Info("dashboard accessed",
		zap.String("user_agent", c.Request().UserAgent()),
		zap.String("remote_ip", c.RealIP()),
	)

	userID := session.GetUserIDAsUint(c)
	ctx := c.Request().Context()
	servers, err := h.serverSvc.ListServersForUser(ctx, userID)
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
