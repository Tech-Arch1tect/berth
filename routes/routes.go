package routes

import (
	"log"
	"net/http"
	"time"

	"berth/handlers"
	"berth/internal/files"
	"berth/internal/logs"
	"berth/internal/maintenance"
	"berth/internal/operationlogs"
	"berth/internal/operations"
	"berth/internal/rbac"
	"berth/internal/server"
	"berth/internal/setup"
	"berth/internal/stack"
	"berth/internal/websocket"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/middleware/csrf"
	"github.com/tech-arch1tect/brx/middleware/inertiacsrf"
	"github.com/tech-arch1tect/brx/middleware/inertiashared"
	"github.com/tech-arch1tect/brx/middleware/jwt"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/middleware/ratelimit"
	brxserver "github.com/tech-arch1tect/brx/server"
	"github.com/tech-arch1tect/brx/services/inertia"
	jwtservice "github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/session"
)

func RegisterRoutes(srv *brxserver.Server, dashboardHandler *handlers.DashboardHandler, authHandler *handlers.AuthHandler, mobileAuthHandler *handlers.MobileAuthHandler, sessionHandler *handlers.SessionHandler, totpHandler *handlers.TOTPHandler, operationLogsHandler *operationlogs.Handler, rbacHandler *rbac.Handler, rbacAPIHandler *rbac.APIHandler, rbacMiddleware *rbac.Middleware, setupHandler *setup.Handler, serverHandler *server.Handler, serverAPIHandler *server.APIHandler, serverUserAPIHandler *server.UserAPIHandler, stackHandler *stack.Handler, stackAPIHandler *stack.APIHandler, maintenanceHandler *maintenance.Handler, maintenanceAPIHandler *maintenance.APIHandler, filesHandler *files.Handler, filesAPIHandler *files.APIHandler, logsHandler *logs.Handler, operationsHandler *operations.Handler, operationsWSHandler *operations.WebSocketHandler, wsHandler *websocket.Handler, sessionManager *session.Manager, sessionService session.SessionService, rateLimitStore ratelimit.Store, inertiaService *inertia.Service, jwtSvc *jwtservice.Service, userProvider jwtshared.UserProvider, cfg *config.Config) {
	e := srv.Echo()
	e.Use(middleware.Recover())

	// Setup custom error handler for better 404/error handling
	handlers.SetupErrorHandler(e, inertiaService)

	// Static file serving for Vite assets
	srv.Get("/build/*", echo.WrapHandler(http.StripPrefix("/build/", http.FileServer(http.Dir("public/build")))))

	// Setup routes (no authentication required)
	if setupHandler != nil {
		srv.Get("/setup/admin", setupHandler.ShowSetup)
		srv.Post("/setup/admin", setupHandler.CreateAdmin)
	}

	// Web routes
	web := srv.Group("")

	// Session middleware
	web.Use(session.Middleware(sessionManager))

	if sessionService != nil {
		web.Use(session.SessionServiceMiddleware(sessionService))
	}

	if cfg.CSRF.Enabled {
		web.Use(csrf.WithConfig(&cfg.CSRF))
		web.Use(inertiacsrf.Middleware(cfg))
	}

	// Inertia middleware
	if inertiaService != nil {
		web.Use(inertiaService.Middleware())

		middlewareConfig := inertiashared.Config{
			AuthEnabled:  true,
			FlashEnabled: true,
			UserProvider: userProvider,
		}
		web.Use(inertiashared.MiddlewareWithConfig(middlewareConfig))
	}

	// Auth routes
	auth := web.Group("/auth")
	authRateLimit := ratelimit.WithConfig(&ratelimit.Config{
		Store:        rateLimitStore,
		Rate:         5,
		Period:       time.Minute,
		CountMode:    config.CountFailures,
		KeyGenerator: ratelimit.SecureKeyGenerator,
	})
	auth.Use(authRateLimit)

	auth.GET("/login", authHandler.ShowLogin)
	auth.POST("/login", authHandler.Login)
	auth.POST("/logout", authHandler.Logout)

	auth.GET("/password-reset", authHandler.ShowPasswordReset)
	auth.POST("/password-reset", authHandler.RequestPasswordReset)
	auth.GET("/password-reset/confirm", authHandler.ShowPasswordResetConfirm)
	auth.POST("/password-reset/confirm", authHandler.ConfirmPasswordReset)

	auth.GET("/verify-email", authHandler.ShowVerifyEmail)
	auth.POST("/verify-email", authHandler.VerifyEmail)
	auth.POST("/resend-verification", authHandler.ResendVerification)

	// TOTP verification
	totpRateLimit := ratelimit.WithConfig(&ratelimit.Config{
		Store:        rateLimitStore,
		Rate:         3,
		Period:       time.Minute,
		CountMode:    config.CountFailures,
		KeyGenerator: ratelimit.SecureKeyGenerator,
	})

	auth.GET("/totp/verify", totpHandler.ShowVerify)
	auth.POST("/totp/verify", totpHandler.VerifyTOTP, totpRateLimit)

	// Protected routes
	protected := web.Group("")
	protected.Use(session.RequireAuthWeb("/auth/login"))
	protected.Use(session.RequireTOTPWeb("/auth/totp/verify"))

	protected.GET("/", dashboardHandler.Dashboard)
	protected.GET("/profile", authHandler.Profile)

	if stackHandler != nil {
		protected.GET("/servers/:id/stacks", stackHandler.ShowServerStacks)
		protected.GET("/servers/:serverid/stacks/:stackname", stackHandler.ShowStackDetails)
	}
	if maintenanceHandler != nil {
		protected.GET("/servers/:serverid/maintenance", maintenanceHandler.ShowMaintenance)
	}
	if filesHandler != nil {
		protected.GET("/servers/:serverid/stacks/:stackname/files", filesHandler.ShowFileManager)
	}
	if stackAPIHandler != nil {
		protected.GET("/api/servers/:id/stacks", stackAPIHandler.ListServerStacks)
		protected.GET("/api/servers/:serverid/stacks/:stackname", stackAPIHandler.GetStackDetails)
		protected.GET("/api/servers/:serverid/stacks/:stackname/permissions", stackAPIHandler.CheckPermissions)
		protected.GET("/api/servers/:serverid/stacks/:stackname/networks", stackAPIHandler.GetStackNetworks)
		protected.GET("/api/servers/:serverid/stacks/:stackname/volumes", stackAPIHandler.GetStackVolumes)
		protected.GET("/api/servers/:serverid/stacks/:stackname/environment", stackAPIHandler.GetStackEnvironmentVariables)
		protected.GET("/api/servers/:serverid/stacks/:stackname/stats", stackAPIHandler.GetStackStats)
	}
	if maintenanceAPIHandler != nil {
		protected.GET("/api/servers/:serverid/maintenance/permissions", maintenanceAPIHandler.CheckPermissions)
		protected.GET("/api/servers/:serverid/maintenance/info", maintenanceAPIHandler.GetSystemInfo)
		protected.POST("/api/servers/:serverid/maintenance/prune", maintenanceAPIHandler.PruneDocker)
		protected.DELETE("/api/servers/:serverid/maintenance/resource", maintenanceAPIHandler.DeleteResource)
	}
	if filesAPIHandler != nil {
		protected.GET("/api/servers/:serverid/stacks/:stackname/files", filesAPIHandler.ListDirectory)
		protected.GET("/api/servers/:serverid/stacks/:stackname/files/read", filesAPIHandler.ReadFile)
		protected.POST("/api/servers/:serverid/stacks/:stackname/files/write", filesAPIHandler.WriteFile)
		protected.POST("/api/servers/:serverid/stacks/:stackname/files/upload", filesAPIHandler.UploadFile)
		protected.POST("/api/servers/:serverid/stacks/:stackname/files/mkdir", filesAPIHandler.CreateDirectory)
		protected.DELETE("/api/servers/:serverid/stacks/:stackname/files/delete", filesAPIHandler.Delete)
		protected.POST("/api/servers/:serverid/stacks/:stackname/files/rename", filesAPIHandler.Rename)
		protected.POST("/api/servers/:serverid/stacks/:stackname/files/copy", filesAPIHandler.Copy)
		protected.POST("/api/servers/:serverid/stacks/:stackname/files/chmod", filesAPIHandler.Chmod)
		protected.POST("/api/servers/:serverid/stacks/:stackname/files/chown", filesAPIHandler.Chown)
		protected.GET("/api/servers/:serverid/stacks/:stackname/files/download", filesAPIHandler.DownloadFile)
		protected.GET("/api/servers/:serverid/stacks/:stackname/files/stats", filesAPIHandler.GetDirectoryStats)
	}
	if logsHandler != nil {
		protected.GET("/api/servers/:serverid/stacks/:stackname/logs", logsHandler.GetStackLogs)
		protected.GET("/api/servers/:serverid/stacks/:stackname/containers/:containerName/logs", logsHandler.GetContainerLogs)
	}
	if operationsHandler != nil {
		protected.POST("/api/servers/:serverid/stacks/:stackname/operations", operationsHandler.StartOperation)
	}

	// User operation logs routes
	if operationLogsHandler != nil {
		protected.GET("/operation-logs", operationLogsHandler.ShowUserOperationLogs)
		protected.GET("/api/operation-logs", operationLogsHandler.ListUserOperationLogs)
		protected.GET("/api/operation-logs/:id", operationLogsHandler.GetUserOperationLogDetails)
	}

	if serverUserAPIHandler != nil {
		protected.GET("/api/servers/:serverid/statistics", serverUserAPIHandler.GetServerStatistics)
	}

	protected.GET("/auth/totp/setup", totpHandler.ShowSetup)
	protected.POST("/auth/totp/enable", totpHandler.EnableTOTP)
	protected.POST("/auth/totp/disable", totpHandler.DisableTOTP)
	protected.GET("/api/totp/status", totpHandler.GetTOTPStatus)

	if sessionHandler != nil {
		protected.GET("/sessions", sessionHandler.Sessions)
		protected.POST("/sessions/revoke", sessionHandler.RevokeSession)
		protected.POST("/sessions/revoke-all-others", sessionHandler.RevokeAllOtherSessions)
	}

	// WebSocket routes
	if wsHandler != nil {
		wsGroup := srv.Group("/ws")

		// Web UI routes
		wsUIGroup := wsGroup.Group("/ui")
		wsUIGroup.Use(session.Middleware(sessionManager))

		wsUIGroup.GET("/stack-status/:server_id", func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				return c.JSON(401, map[string]string{"error": "Not authenticated"})
			}
			if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
				return c.JSON(401, map[string]string{"error": "TOTP verification required"})
			}
			return wsHandler.HandleWebUIWebSocket(c)
		})

		wsUIGroup.GET("/servers/:serverid/terminal", func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				log.Printf("WebSocket Route: User not authenticated")
				return c.JSON(401, map[string]string{"error": "Not authenticated"})
			}
			if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
				log.Printf("WebSocket Route: TOTP verification required")
				return c.JSON(401, map[string]string{"error": "TOTP verification required"})
			}
			return wsHandler.HandleWebUITerminalWebSocket(c)
		})

		if operationsWSHandler != nil {
			wsUIGroup.GET("/servers/:serverid/stacks/:stackname/operations", func(c echo.Context) error {
				if !session.IsAuthenticated(c) {
					return c.JSON(401, map[string]string{"error": "Not authenticated"})
				}
				if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
					return c.JSON(401, map[string]string{"error": "TOTP verification required"})
				}
				return operationsWSHandler.HandleOperationWebSocket(c)
			})

			wsUIGroup.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", func(c echo.Context) error {
				if !session.IsAuthenticated(c) {
					return c.JSON(401, map[string]string{"error": "Not authenticated"})
				}
				if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
					return c.JSON(401, map[string]string{"error": "TOTP verification required"})
				}
				return operationsWSHandler.HandleOperationWebSocket(c)
			})
		}

		// API routes
		wsAPIGroup := wsGroup.Group("/api")
		wsAPIGroup.Use(jwt.RequireJWT(jwtSvc))
		wsAPIGroup.Use(jwtshared.MiddlewareWithConfig(jwtshared.Config{
			UserProvider: userProvider,
		}))
		wsAPIGroup.GET("/stack-status/:server_id", wsHandler.HandleFlutterWebSocket)
		wsAPIGroup.GET("/servers/:serverid/terminal", wsHandler.HandleFlutterTerminalWebSocket)

		if operationsWSHandler != nil {
			wsAPIGroup.GET("/servers/:serverid/stacks/:stackname/operations", operationsWSHandler.HandleOperationWebSocket)
			wsAPIGroup.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", operationsWSHandler.HandleOperationWebSocket)
		}
	}

	// Admin routes - require admin role
	if rbacHandler != nil && rbacMiddleware != nil {
		admin := protected.Group("/admin")
		admin.Use(rbacMiddleware.RequireRole("admin"))

		admin.GET("/users", rbacHandler.ListUsers)
		admin.POST("/users", rbacHandler.CreateUser)
		admin.GET("/users/:id/roles", rbacHandler.ShowUserRoles)
		admin.POST("/users/assign-role", rbacHandler.AssignRole)
		admin.POST("/users/revoke-role", rbacHandler.RevokeRole)

		admin.GET("/roles", rbacHandler.ListRoles)
		admin.POST("/roles", rbacHandler.CreateRole)
		admin.PUT("/roles/:id", rbacHandler.UpdateRole)
		admin.DELETE("/roles/:id", rbacHandler.DeleteRole)
		admin.GET("/roles/:id/stack-permissions", rbacHandler.RoleServerStackPermissions)
		admin.POST("/roles/:id/stack-permissions", rbacHandler.CreateRoleStackPermission)
		admin.DELETE("/roles/:id/stack-permissions/:permissionId", rbacHandler.DeleteRoleStackPermission)

		// Operation logs routes
		if operationLogsHandler != nil {
			admin.GET("/operation-logs", operationLogsHandler.ShowOperationLogs)
			admin.GET("/api/operation-logs", operationLogsHandler.ListOperationLogs)
			admin.GET("/api/operation-logs/stats", operationLogsHandler.GetOperationLogsStats)
			admin.GET("/api/operation-logs/:id", operationLogsHandler.GetOperationLogDetails)
		}

		if serverHandler != nil {
			admin.GET("/servers", serverHandler.Index)
			admin.GET("/servers/:id", serverHandler.Show)
			admin.POST("/servers", serverHandler.Store)
			admin.PUT("/servers/:id", serverHandler.Update)
			admin.DELETE("/servers/:id", serverHandler.Delete)
			admin.POST("/servers/:id/test", serverHandler.TestConnection)
		}
	}

	// API routes
	if mobileAuthHandler != nil && jwtSvc != nil {
		api := srv.Group("/api/v1")

		authApiRateLimit := ratelimit.WithConfig(&ratelimit.Config{
			Store:        rateLimitStore,
			Rate:         25,
			Period:       time.Minute,
			CountMode:    config.CountFailures,
			KeyGenerator: ratelimit.SecureKeyGenerator,
		})

		generalApiRateLimit := ratelimit.WithConfig(&ratelimit.Config{
			Store:        rateLimitStore,
			Rate:         1000,
			Period:       time.Minute * 10,
			CountMode:    config.CountAll,
			KeyGenerator: ratelimit.DefaultKeyGenerator,
		})

		authApi := api.Group("/auth")
		authApi.Use(authApiRateLimit)
		authApi.POST("/login", mobileAuthHandler.Login)
		authApi.POST("/refresh", mobileAuthHandler.RefreshToken)
		authApi.POST("/totp/verify", mobileAuthHandler.VerifyTOTP)

		apiProtected := api.Group("")
		apiProtected.Use(generalApiRateLimit)
		apiProtected.Use(jwt.RequireJWT(jwtSvc))
		apiProtected.Use(jwtshared.MiddlewareWithConfig(jwtshared.Config{
			UserProvider: userProvider,
		}))
		apiProtected.GET("/profile", mobileAuthHandler.Profile)
		apiProtected.POST("/auth/logout", mobileAuthHandler.Logout)

		apiProtected.GET("/totp/setup", mobileAuthHandler.GetTOTPSetup)
		apiProtected.POST("/totp/enable", mobileAuthHandler.EnableTOTP)
		apiProtected.POST("/totp/disable", mobileAuthHandler.DisableTOTP)
		apiProtected.GET("/totp/status", mobileAuthHandler.GetTOTPStatus)

		apiProtected.POST("/sessions", mobileAuthHandler.GetSessions)
		apiProtected.POST("/sessions/revoke", mobileAuthHandler.RevokeSession)
		apiProtected.POST("/sessions/revoke-all-others", mobileAuthHandler.RevokeAllOtherSessions)

		if serverUserAPIHandler != nil {
			apiProtected.GET("/servers", serverUserAPIHandler.ListServers)
			apiProtected.GET("/servers/:serverid/statistics", serverUserAPIHandler.GetServerStatistics)
		}

		if stackAPIHandler != nil {
			apiProtected.GET("/servers/:id/stacks", stackAPIHandler.ListServerStacks)
			apiProtected.GET("/servers/:serverid/stacks/:stackname", stackAPIHandler.GetStackDetails)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/permissions", stackAPIHandler.CheckPermissions)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/networks", stackAPIHandler.GetStackNetworks)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/volumes", stackAPIHandler.GetStackVolumes)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/environment", stackAPIHandler.GetStackEnvironmentVariables)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/stats", stackAPIHandler.GetStackStats)
		}
		if filesAPIHandler != nil {
			apiProtected.GET("/servers/:serverid/stacks/:stackname/files", filesAPIHandler.ListDirectory)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/files/read", filesAPIHandler.ReadFile)
			apiProtected.POST("/servers/:serverid/stacks/:stackname/files/write", filesAPIHandler.WriteFile)
			apiProtected.POST("/servers/:serverid/stacks/:stackname/files/upload", filesAPIHandler.UploadFile)
			apiProtected.POST("/servers/:serverid/stacks/:stackname/files/mkdir", filesAPIHandler.CreateDirectory)
			apiProtected.DELETE("/servers/:serverid/stacks/:stackname/files/delete", filesAPIHandler.Delete)
			apiProtected.POST("/servers/:serverid/stacks/:stackname/files/rename", filesAPIHandler.Rename)
			apiProtected.POST("/servers/:serverid/stacks/:stackname/files/copy", filesAPIHandler.Copy)
			apiProtected.POST("/servers/:serverid/stacks/:stackname/files/chmod", filesAPIHandler.Chmod)
			apiProtected.POST("/servers/:serverid/stacks/:stackname/files/chown", filesAPIHandler.Chown)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/files/download", filesAPIHandler.DownloadFile)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/files/stats", filesAPIHandler.GetDirectoryStats)
		}
		if logsHandler != nil {
			apiProtected.GET("/servers/:serverid/stacks/:stackname/logs", logsHandler.GetStackLogs)
			apiProtected.GET("/servers/:serverid/stacks/:stackname/containers/:containerName/logs", logsHandler.GetContainerLogs)
		}
		if operationsHandler != nil {
			apiProtected.POST("/servers/:serverid/stacks/:stackname/operations", operationsHandler.StartOperation)
		}
		if maintenanceAPIHandler != nil {
			apiProtected.GET("/servers/:serverid/maintenance/permissions", maintenanceAPIHandler.CheckPermissions)
			apiProtected.GET("/servers/:serverid/maintenance/info", maintenanceAPIHandler.GetSystemInfo)
			apiProtected.POST("/servers/:serverid/maintenance/prune", maintenanceAPIHandler.PruneDocker)
			apiProtected.DELETE("/servers/:serverid/maintenance/resource", maintenanceAPIHandler.DeleteResource)
		}

		if rbacAPIHandler != nil && rbacMiddleware != nil {

			// Admin routes
			apiAdmin := apiProtected.Group("/admin")
			apiAdmin.Use(rbacMiddleware.RequireRoleJWT("admin"))

			apiAdmin.GET("/users", rbacAPIHandler.ListUsers)
			apiAdmin.POST("/users", rbacAPIHandler.CreateUser)
			apiAdmin.GET("/users/:id/roles", rbacAPIHandler.GetUserRoles)
			apiAdmin.POST("/users/assign-role", rbacAPIHandler.AssignRole)
			apiAdmin.POST("/users/revoke-role", rbacAPIHandler.RevokeRole)

			apiAdmin.GET("/roles", rbacAPIHandler.ListRoles)
			apiAdmin.POST("/roles", rbacAPIHandler.CreateRole)
			apiAdmin.PUT("/roles/:id", rbacAPIHandler.UpdateRole)
			apiAdmin.DELETE("/roles/:id", rbacAPIHandler.DeleteRole)
			apiAdmin.GET("/roles/:roleId/stack-permissions", rbacAPIHandler.ListRoleServerStackPermissions)
			apiAdmin.POST("/roles/:roleId/stack-permissions", rbacAPIHandler.CreateRoleStackPermission)
			apiAdmin.DELETE("/roles/:roleId/stack-permissions/:permissionId", rbacAPIHandler.DeleteRoleStackPermission)

			// Operation logs API routes
			if operationLogsHandler != nil {
				apiAdmin.GET("/operation-logs", operationLogsHandler.ListOperationLogs)
				apiAdmin.GET("/operation-logs/stats", operationLogsHandler.GetOperationLogsStats)
				apiAdmin.GET("/operation-logs/:id", operationLogsHandler.GetOperationLogDetails)
			}

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
