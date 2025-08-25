package routes

import (
	"net/http"
	"time"

	"brx-starter-kit/handlers"
	"brx-starter-kit/internal/rbac"
	"brx-starter-kit/internal/server"
	"brx-starter-kit/internal/setup"
	"brx-starter-kit/internal/stack"
	"brx-starter-kit/internal/websocket"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/middleware/csrf"
	"github.com/tech-arch1tect/brx/middleware/inertiacsrf"
	"github.com/tech-arch1tect/brx/middleware/jwt"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/middleware/ratelimit"
	brxserver "github.com/tech-arch1tect/brx/server"
	"github.com/tech-arch1tect/brx/services/inertia"
	jwtservice "github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/session"
)

func RegisterRoutes(srv *brxserver.Server, dashboardHandler *handlers.DashboardHandler, authHandler *handlers.AuthHandler, mobileAuthHandler *handlers.MobileAuthHandler, sessionHandler *handlers.SessionHandler, totpHandler *handlers.TOTPHandler, rbacHandler *rbac.Handler, rbacAPIHandler *rbac.APIHandler, rbacMiddleware *rbac.Middleware, setupHandler *setup.Handler, serverHandler *server.Handler, serverAPIHandler *server.APIHandler, serverUserAPIHandler *server.UserAPIHandler, stackHandler *stack.Handler, stackAPIHandler *stack.APIHandler, stackWebAPIHandler *stack.WebAPIHandler, wsHandler *websocket.Handler, sessionManager *session.Manager, sessionService session.SessionService, rateLimitStore ratelimit.Store, inertiaService *inertia.Service, jwtSvc *jwtservice.Service, userProvider jwtshared.UserProvider, cfg *config.Config) {
	e := srv.Echo()
	e.Use(session.Middleware(sessionManager))

	// Add session service middleware if available
	if sessionService != nil {
		e.Use(session.SessionServiceMiddleware(sessionService))
	}

	// Setup custom error handler for better 404/error handling
	handlers.SetupErrorHandler(e, inertiaService)

	// Static file serving for Vite assets
	srv.Get("/build/*", echo.WrapHandler(http.StripPrefix("/build/", http.FileServer(http.Dir("public/build")))))

	// Setup routes (no authentication required)
	if setupHandler != nil {
		srv.Get("/setup/admin", setupHandler.ShowSetup)
		srv.Post("/setup/admin", setupHandler.CreateAdmin)
	}

	// Web routes group (requires CSRF protection)
	web := srv.Group("")
	if cfg.CSRF.Enabled {
		web.Use(csrf.WithConfig(&cfg.CSRF))
		web.Use(inertiacsrf.Middleware(cfg))
	}

	// Authentication route group with rate limiting
	auth := web.Group("/auth")
	authRateLimit := ratelimit.WithConfig(&ratelimit.Config{
		Store:        rateLimitStore,
		Rate:         5,
		Period:       time.Minute,
		CountMode:    config.CountFailures,
		KeyGenerator: ratelimit.SecureKeyGenerator,
	})
	auth.Use(authRateLimit)

	// Authentication routes (all inherit rate limiting from group)
	auth.GET("/login", authHandler.ShowLogin)
	auth.POST("/login", authHandler.Login)
	auth.GET("/register", authHandler.ShowRegister)
	auth.POST("/register", authHandler.Register)
	auth.POST("/logout", authHandler.Logout)

	// Password reset routes
	auth.GET("/password-reset", authHandler.ShowPasswordReset)
	auth.POST("/password-reset", authHandler.RequestPasswordReset)
	auth.GET("/password-reset/confirm", authHandler.ShowPasswordResetConfirm)
	auth.POST("/password-reset/confirm", authHandler.ConfirmPasswordReset)

	// Email verification routes
	auth.GET("/verify-email", authHandler.ShowVerifyEmail)
	auth.POST("/verify-email", authHandler.VerifyEmail)
	auth.POST("/resend-verification", authHandler.ResendVerification)

	// TOTP verification routes (for already authenticated users) - with stricter rate limiting
	totpRateLimit := ratelimit.WithConfig(&ratelimit.Config{
		Store:        rateLimitStore,
		Rate:         3,
		Period:       time.Minute,
		CountMode:    config.CountFailures,
		KeyGenerator: ratelimit.SecureKeyGenerator,
	})

	auth.GET("/totp/verify", totpHandler.ShowVerify)
	auth.POST("/totp/verify", totpHandler.VerifyTOTP, totpRateLimit)

	// Protected routes group (requires auth + TOTP if user has TOTP enabled)
	protected := web.Group("")
	protected.Use(session.RequireAuthWeb("/auth/login"))
	protected.Use(session.RequireTOTPWeb("/auth/totp/verify"))

	// Application routes
	protected.GET("/", dashboardHandler.Dashboard)
	protected.GET("/profile", authHandler.Profile)

	// Server-specific stack routes
	if stackHandler != nil {
		protected.GET("/servers/:id/stacks", stackHandler.ShowServerStacks)
		protected.GET("/servers/:serverid/stacks/:stackname", stackHandler.ShowStackDetails)
	}
	if stackWebAPIHandler != nil {
		protected.GET("/api/servers/:id/stacks", stackWebAPIHandler.ListServerStacks)
		protected.GET("/api/servers/:serverid/stacks/:stackname", stackWebAPIHandler.GetStackDetails)
	}

	// TOTP management routes
	protected.GET("/auth/totp/setup", totpHandler.ShowSetup)
	protected.POST("/auth/totp/enable", totpHandler.EnableTOTP)
	protected.POST("/auth/totp/disable", totpHandler.DisableTOTP)
	protected.GET("/api/totp/status", totpHandler.GetTOTPStatus)

	// Session management routes
	if sessionHandler != nil {
		protected.GET("/sessions", sessionHandler.Sessions)
		protected.POST("/sessions/revoke", sessionHandler.RevokeSession)
		protected.POST("/sessions/revoke-all-others", sessionHandler.RevokeAllOtherSessions)
	}

	// WebSocket routes for web UI (completely separate Echo instance - this is to ensure no middleware interferes with WebSocket connections like setting headers etc)
	if wsHandler != nil {
		wsEcho := echo.New()
		wsEcho.HideBanner = true

		wsEcho.Use(session.Middleware(sessionManager))

		wsEcho.GET("/ui/stack-status/:server_id", func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				return c.JSON(401, map[string]string{"error": "Not authenticated"})
			}
			if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
				return c.JSON(401, map[string]string{"error": "TOTP verification required"})
			}
			return wsHandler.HandleWebUIWebSocket(c)
		})

		wsEcho.GET("/ui/operations", func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				return c.JSON(401, map[string]string{"error": "Not authenticated"})
			}
			if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
				return c.JSON(401, map[string]string{"error": "TOTP verification required"})
			}
			return wsHandler.HandleOperationsWebSocket(c)
		})

		srv.Echo().Any("/ws/*", echo.WrapHandler(http.StripPrefix("/ws", wsEcho)))
	}

	// Admin routes - require admin role
	if rbacHandler != nil && rbacMiddleware != nil {
		admin := protected.Group("/admin")
		admin.Use(rbacMiddleware.RequireRole("admin"))

		// User management
		admin.GET("/users", rbacHandler.ListUsers)
		admin.GET("/users/:id/roles", rbacHandler.ShowUserRoles)
		admin.POST("/users/assign-role", rbacHandler.AssignRole)
		admin.POST("/users/revoke-role", rbacHandler.RevokeRole)

		// Role management
		admin.GET("/roles", rbacHandler.ListRoles)
		admin.POST("/roles", rbacHandler.CreateRole)
		admin.PUT("/roles/:id", rbacHandler.UpdateRole)
		admin.DELETE("/roles/:id", rbacHandler.DeleteRole)
		admin.GET("/roles/:id/server-permissions", rbacHandler.RoleServerPermissions)
		admin.POST("/roles/:id/server-permissions", rbacHandler.UpdateRoleServerPermissions)

		// Server management
		if serverHandler != nil {
			admin.GET("/servers", serverHandler.Index)
			admin.GET("/servers/:id", serverHandler.Show)
			admin.POST("/servers", serverHandler.Store)
			admin.PUT("/servers/:id", serverHandler.Update)
			admin.DELETE("/servers/:id", serverHandler.Delete)
			admin.POST("/servers/:id/test", serverHandler.TestConnection)
		}
	}

	// JWT authentication api routes - for non-web clients (flutter)
	if mobileAuthHandler != nil && jwtSvc != nil {
		api := srv.Group("/api/v1")

		// API rate limiting
		apiRateLimit := ratelimit.WithConfig(&ratelimit.Config{
			Store:        rateLimitStore,
			Rate:         50,
			Period:       time.Minute * 3,
			CountMode:    config.CountAll,
			KeyGenerator: ratelimit.DefaultKeyGenerator,
		})
		api.Use(apiRateLimit)

		// Public API routes
		api.POST("/auth/login", mobileAuthHandler.Login)
		api.POST("/auth/register", mobileAuthHandler.Register)
		api.POST("/auth/refresh", mobileAuthHandler.RefreshToken)
		api.POST("/auth/totp/verify", mobileAuthHandler.VerifyTOTP)

		// Protected API routes
		apiProtected := api.Group("")
		apiProtected.Use(jwt.RequireJWT(jwtSvc))
		apiProtected.Use(jwtshared.MiddlewareWithConfig(jwtshared.Config{
			UserProvider: userProvider,
		}))
		apiProtected.GET("/profile", mobileAuthHandler.Profile)
		apiProtected.POST("/auth/logout", mobileAuthHandler.Logout)

		// TOTP management routes
		apiProtected.GET("/totp/setup", mobileAuthHandler.GetTOTPSetup)
		apiProtected.POST("/totp/enable", mobileAuthHandler.EnableTOTP)
		apiProtected.POST("/totp/disable", mobileAuthHandler.DisableTOTP)
		apiProtected.GET("/totp/status", mobileAuthHandler.GetTOTPStatus)

		// Session management routes for JWT users
		apiProtected.POST("/sessions", mobileAuthHandler.GetSessions)
		apiProtected.POST("/sessions/revoke", mobileAuthHandler.RevokeSession)
		apiProtected.POST("/sessions/revoke-all-others", mobileAuthHandler.RevokeAllOtherSessions)

		// User server routes
		if serverUserAPIHandler != nil {
			apiProtected.GET("/servers", serverUserAPIHandler.ListServers)
		}

		// Stack routes
		if stackAPIHandler != nil {
			apiProtected.GET("/servers/:id/stacks", stackAPIHandler.ListServerStacks)
			apiProtected.GET("/servers/:serverid/stacks/:stackname", stackAPIHandler.GetStackDetails)
		}

		// WebSocket routes for Flutter/API clients (JWT authenticated)
		if wsHandler != nil {
			apiProtected.GET("/ws/api/stack-status/:server_id", wsHandler.HandleFlutterWebSocket)
			apiProtected.GET("/ws/api/operations", wsHandler.HandleFlutterOperationsWebSocket)
		}

		// RBAC routes for JWT users
		if rbacAPIHandler != nil && rbacMiddleware != nil {
			// User permission checking
			apiProtected.GET("/rbac/permissions", rbacAPIHandler.GetCurrentUserPermissions)
			apiProtected.POST("/rbac/check-permission", rbacAPIHandler.CheckPermission)

			// Admin routes - require admin role
			apiAdmin := apiProtected.Group("/admin")
			apiAdmin.Use(rbacMiddleware.RequireRoleJWT("admin"))

			// User management
			apiAdmin.GET("/users", rbacAPIHandler.ListUsers)
			apiAdmin.GET("/users/:id/roles", rbacAPIHandler.GetUserRoles)
			apiAdmin.POST("/users/assign-role", rbacAPIHandler.AssignRole)
			apiAdmin.POST("/users/revoke-role", rbacAPIHandler.RevokeRole)

			// Role management
			apiAdmin.GET("/roles", rbacAPIHandler.ListRoles)
			apiAdmin.POST("/roles", rbacAPIHandler.CreateRole)
			apiAdmin.PUT("/roles/:id", rbacAPIHandler.UpdateRole)
			apiAdmin.DELETE("/roles/:id", rbacAPIHandler.DeleteRole)
			apiAdmin.GET("/roles/:roleId/server-permissions", rbacAPIHandler.ListRoleServerPermissions)
			apiAdmin.POST("/roles/:roleId/server-permissions", rbacAPIHandler.UpdateRoleServerPermissions)

			// Server management
			if serverAPIHandler != nil {
				apiAdmin.GET("/servers", serverAPIHandler.ListServers)
				apiAdmin.GET("/servers/:id", serverAPIHandler.GetServer)
				apiAdmin.POST("/servers", serverAPIHandler.CreateServer)
				apiAdmin.PUT("/servers/:id", serverAPIHandler.UpdateServer)
				apiAdmin.DELETE("/servers/:id", serverAPIHandler.DeleteServer)
				apiAdmin.POST("/servers/:id/test", serverAPIHandler.TestConnection)
			}
		}
	}
}
