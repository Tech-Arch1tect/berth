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

type StacksHandler struct {
	inertiaSvc *inertia.Service
	db         *gorm.DB
	logger     *logging.Service
	serverSvc  *server.Service
}

func NewStacksHandler(inertiaSvc *inertia.Service, db *gorm.DB, logger *logging.Service, serverSvc *server.Service) *StacksHandler {
	return &StacksHandler{
		inertiaSvc: inertiaSvc,
		db:         db,
		logger:     logger,
		serverSvc:  serverSvc,
	}
}

func (h *StacksHandler) Index(c echo.Context) error {
	h.logger.Info("stacks index accessed",
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

	h.logger.Info("stacks index data retrieved",
		zap.Int("server_count", len(servers)),
	)

	return h.inertiaSvc.Render(c, "Stacks", gonertia.Props{
		"title":   "All Stacks",
		"servers": servers,
	})
}
