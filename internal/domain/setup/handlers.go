package setup

import (
	"net/http"
	"strings"

	"berth/internal/domain/auth"
	"berth/internal/domain/session"
	"berth/internal/pkg/validation"
	"berth/internal/platform/inertia"
	"berth/internal/platform/inertia/errpage"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

type Handler struct {
	setupSvc   *Service
	authSvc    *auth.Service
	inertiaSvc *inertia.Service
	errPage    *errpage.Renderer
	logger     *zap.Logger
}

func NewHandler(setupSvc *Service, authSvc *auth.Service, inertiaSvc *inertia.Service, logger *zap.Logger) *Handler {
	return &Handler{
		setupSvc:   setupSvc,
		authSvc:    authSvc,
		inertiaSvc: inertiaSvc,
		errPage:    errpage.New(inertiaSvc),
		logger:     logger,
	}
}

func (h *Handler) ShowSetup(c echo.Context) error {
	adminExists, err := h.setupSvc.AdminExists()
	if err != nil {
		h.logger.Error("failed to check admin existence", zap.Error(err))
		return h.errPage.Render(c, http.StatusInternalServerError, "Failed to check setup status")
	}

	if adminExists {
		return c.Redirect(http.StatusFound, "/auth/login")
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
		session.AddFlashError(c, "Setup already completed")
		return c.Redirect(http.StatusFound, "/auth/login")
	}

	var req CreateInitialAdminForm

	if err := validation.BindRequest(c, &req); err != nil {
		return err
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
			session.AddFlashError(c, "Setup already completed")
			return c.Redirect(http.StatusFound, "/auth/login")
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
