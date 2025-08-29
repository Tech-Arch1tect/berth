package setup

import (
	"brx-starter-kit/internal/common"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/zap"
)

type Handler struct {
	setupSvc   *Service
	authSvc    *auth.Service
	inertiaSvc *inertia.Service
	logger     *logging.Service
}

func NewHandler(setupSvc *Service, authSvc *auth.Service, inertiaSvc *inertia.Service, logger *logging.Service) *Handler {
	return &Handler{
		setupSvc:   setupSvc,
		authSvc:    authSvc,
		inertiaSvc: inertiaSvc,
		logger:     logger,
	}
}

func (h *Handler) ShowSetup(c echo.Context) error {
	adminExists, err := h.setupSvc.AdminExists()
	if err != nil {
		h.logger.Error("failed to check admin existence", zap.Error(err))
		return common.SendInternalError(c, "Failed to check setup status")
	}

	if adminExists {
		return common.SendNotFound(c, "Setup already completed")
	}

	return h.inertiaSvc.Render(c, "Setup/Admin", map[string]any{
		"title": "Admin Setup",
	})
}

func (h *Handler) CreateAdmin(c echo.Context) error {
	adminExists, err := h.setupSvc.AdminExists()
	if err != nil {
		h.logger.Error("failed to check admin existence", zap.Error(err))
		session.AddFlashError(c, "Failed to check setup status")
		return c.Redirect(http.StatusFound, "/setup/admin")
	}

	if adminExists {
		return common.SendNotFound(c, "Setup already completed")
	}

	var req struct {
		Username        string `form:"username" json:"username"`
		Email           string `form:"email" json:"email"`
		Password        string `form:"password" json:"password"`
		PasswordConfirm string `form:"password_confirm" json:"password_confirm"`
	}

	if err := c.Bind(&req); err != nil {
		session.AddFlashError(c, "Invalid request")
		return c.Redirect(http.StatusFound, "/setup/admin")
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		session.AddFlashError(c, "All fields are required")
		return c.Redirect(http.StatusFound, "/setup/admin")
	}

	if req.Password != req.PasswordConfirm {
		session.AddFlashError(c, "Passwords do not match")
		return c.Redirect(http.StatusFound, "/setup/admin")
	}

	if err := h.authSvc.ValidatePassword(req.Password); err != nil {
		session.AddFlashError(c, err.Error())
		return c.Redirect(http.StatusFound, "/setup/admin")
	}

	hashedPassword, err := h.authSvc.HashPassword(req.Password)
	if err != nil {
		h.logger.Error("failed to hash password", zap.Error(err))
		session.AddFlashError(c, "Failed to process password")
		return c.Redirect(http.StatusFound, "/setup/admin")
	}

	user, err := h.setupSvc.CreateAdmin(req.Username, req.Email, hashedPassword)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			return common.SendError(c, http.StatusConflict, "Setup already completed")
		}
		h.logger.Error("failed to create admin user", zap.Error(err))
		session.AddFlashError(c, "Failed to create admin user")
		return c.Redirect(http.StatusFound, "/setup/admin")
	}

	h.logger.Info("admin user created successfully",
		zap.String("username", user.Username),
		zap.String("email", user.Email),
		zap.Uint("user_id", user.ID),
	)

	session.AddFlashSuccess(c, "Admin user created successfully! You can now log in.")
	return c.Redirect(http.StatusFound, "/auth/login")
}
