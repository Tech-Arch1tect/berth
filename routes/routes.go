package routes

import (
	"log"
	"net/http"
	"time"

	"berth/handlers"
	"berth/internal/apikey"
	berthauth "berth/internal/auth"
	"berth/internal/files"
	"berth/internal/imageupdates"
	"berth/internal/logs"
	"berth/internal/maintenance"
	"berth/internal/migration"
	"berth/internal/operationlogs"
	"berth/internal/operations"
	"berth/internal/rbac"
	"berth/internal/registry"
	"berth/internal/security"
	"berth/internal/server"
	"berth/internal/setup"
	"berth/internal/stack"
	"berth/internal/vulnscan"
	"berth/internal/websocket"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tech-arch1tect/brx/config"
	"github.com/tech-arch1tect/brx/middleware/csrf"
	"github.com/tech-arch1tect/brx/middleware/inertiacsrf"
	"github.com/tech-arch1tect/brx/middleware/inertiashared"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/middleware/ratelimit"
	"github.com/tech-arch1tect/brx/middleware/rememberme"
	brxserver "github.com/tech-arch1tect/brx/server"
	"github.com/tech-arch1tect/brx/services/auth"
	"github.com/tech-arch1tect/brx/services/inertia"
	jwtservice "github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
)

func RegisterRoutes(srv *brxserver.Server, dashboardHandler *handlers.DashboardHandler, stacksHandler *handlers.StacksHandler, authHandler *handlers.AuthHandler, mobileAuthHandler *handlers.MobileAuthHandler, sessionHandler *handlers.SessionHandler, totpHandler *handlers.TOTPHandler, versionHandler *handlers.VersionHandler, migrationHandler *migration.Handler, operationLogsHandler *operationlogs.Handler, rbacHandler *rbac.Handler, rbacAPIHandler *rbac.APIHandler, rbacMiddleware *rbac.Middleware, setupHandler *setup.Handler, serverHandler *server.Handler, serverAPIHandler *server.APIHandler, serverUserAPIHandler *server.UserAPIHandler, stackHandler *stack.Handler, stackAPIHandler *stack.APIHandler, maintenanceHandler *maintenance.Handler, maintenanceAPIHandler *maintenance.APIHandler, filesAPIHandler *files.APIHandler, logsHandler *logs.Handler, operationsHandler *operations.Handler, operationsWSHandler *operations.WebSocketHandler, registryHandler *registry.Handler, registryAPIHandler *registry.APIHandler, wsHandler *websocket.Handler, securityHandler *security.Handler, apiKeyHandler *apikey.Handler, apiKeySvc *apikey.Service, imageUpdatesAPIHandler *imageupdates.APIHandler, vulnscanHandler *vulnscan.Handler, sessionManager *session.Manager, sessionService session.SessionService, rateLimitStore ratelimit.Store, inertiaService *inertia.Service, jwtSvc *jwtservice.Service, userProvider jwtshared.UserProvider, authSvc *auth.Service, totpSvc *totp.Service, logger *logging.Service, cfg *config.Config) {
	if rbacMiddleware != nil && apiKeySvc != nil {
		rbacMiddleware.SetAPIKeyService(apiKeySvc)
	}

	e := srv.Echo()
	e.Use(middleware.Recover())
	handlers.SetupErrorHandler(e, inertiaService)

	// ============================================================================
	// PUBLIC ROUTES
	// ============================================================================

	srv.Get("/build/*", echo.WrapHandler(http.StripPrefix("/build/", http.FileServer(http.Dir("public/build")))))

	if setupHandler != nil {
		srv.Get("/setup/admin", setupHandler.ShowSetup)
		srv.Post("/setup/admin", setupHandler.CreateAdmin)
	}

	// ============================================================================
	// WEB UI ROUTES - Session Auth Only
	// ============================================================================

	web := srv.Group("")
	web.Use(session.Middleware(sessionManager))
	if sessionService != nil {
		web.Use(session.SessionServiceMiddleware(sessionService))
	}
	web.Use(rememberme.Middleware(rememberme.Config{
		AuthService:  authSvc,
		UserProvider: userProvider,
		TOTPService:  totpSvc,
		Logger:       logger,
	}))
	if cfg.CSRF.Enabled {
		web.Use(csrf.WithConfig(&cfg.CSRF))
		web.Use(inertiacsrf.Middleware(cfg))
	}
	if inertiaService != nil {
		web.Use(inertiaService.Middleware())
		web.Use(inertiashared.MiddlewareWithConfig(inertiashared.Config{
			AuthEnabled:  true,
			FlashEnabled: true,
			UserProvider: userProvider,
		}))
	}

	registerAuthRoutes(web, authHandler, totpHandler, rateLimitStore)
	registerProtectedWebRoutes(web,
		dashboardHandler, stacksHandler, authHandler, sessionHandler, totpHandler,
		versionHandler, stackHandler, maintenanceHandler, registryHandler,
		operationLogsHandler, apiKeyHandler,
		registryAPIHandler)
	registerAdminWebRoutes(web, rbacMiddleware, inertiaService,
		rbacHandler, operationLogsHandler, serverHandler,
		migrationHandler, securityHandler)
	registerWebUIWebSocketRoutes(srv, sessionManager, wsHandler, operationsWSHandler)

	// ============================================================================
	// API ROUTES - Hybrid Auth (Session OR JWT OR API Key)
	// ============================================================================

	if mobileAuthHandler != nil && jwtSvc != nil {
		api := srv.Group("/api/v1")
		api.Use(session.Middleware(sessionManager))
		if sessionService != nil {
			api.Use(session.SessionServiceMiddleware(sessionService))
		}
		if cfg.CSRF.Enabled {
			api.Use(berthauth.ConditionalCSRFMiddleware(cfg))
		}

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

		registerAPIAuthRoutes(api, authApiRateLimit, mobileAuthHandler)
		registerProtectedAPIRoutes(api, generalApiRateLimit, jwtSvc, apiKeySvc, userProvider,
			rbacMiddleware, mobileAuthHandler, serverUserAPIHandler,
			stackAPIHandler, filesAPIHandler, logsHandler, operationsHandler,
			operationLogsHandler, maintenanceAPIHandler, vulnscanHandler,
			imageUpdatesAPIHandler, apiKeyHandler, versionHandler, registryAPIHandler)
		registerAdminAPIRoutes(api, generalApiRateLimit, jwtSvc, apiKeySvc, userProvider,
			rbacMiddleware, rbacAPIHandler, operationLogsHandler,
			serverAPIHandler, migrationHandler, securityHandler)
		registerAPIWebSocketRoutes(srv, jwtSvc, apiKeySvc, userProvider, wsHandler, operationsWSHandler)
	}
}

// ============================================================================
// WEB UI ROUTE HELPERS
// ============================================================================

func registerAuthRoutes(web *echo.Group, authHandler *handlers.AuthHandler, totpHandler *handlers.TOTPHandler, rateLimitStore ratelimit.Store) {
	auth := web.Group("/auth")
	auth.Use(ratelimit.WithConfig(&ratelimit.Config{
		Store:        rateLimitStore,
		Rate:         5,
		Period:       time.Minute,
		CountMode:    config.CountFailures,
		KeyGenerator: ratelimit.SecureKeyGenerator,
	}))

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

	totpRateLimit := ratelimit.WithConfig(&ratelimit.Config{
		Store:        rateLimitStore,
		Rate:         3,
		Period:       time.Minute,
		CountMode:    config.CountFailures,
		KeyGenerator: ratelimit.SecureKeyGenerator,
	})
	auth.GET("/totp/verify", totpHandler.ShowVerify)
	auth.POST("/totp/verify", totpHandler.VerifyTOTP, totpRateLimit)
}

func registerProtectedWebRoutes(web *echo.Group,
	dashboardHandler *handlers.DashboardHandler, stacksHandler *handlers.StacksHandler, authHandler *handlers.AuthHandler,
	sessionHandler *handlers.SessionHandler, totpHandler *handlers.TOTPHandler, versionHandler *handlers.VersionHandler, stackHandler *stack.Handler,
	maintenanceHandler *maintenance.Handler, registryHandler *registry.Handler,
	operationLogsHandler *operationlogs.Handler, apiKeyHandler *apikey.Handler,
	registryAPIHandler *registry.APIHandler) {

	protected := web.Group("")
	protected.Use(session.RequireAuthWeb("/auth/login"))
	protected.Use(session.RequireTOTPWeb("/auth/totp/verify"))

	// Inertia Pages
	protected.GET("/", dashboardHandler.Dashboard)
	protected.GET("/stacks", stacksHandler.Index)
	protected.GET("/profile", authHandler.Profile)
	if stackHandler != nil {
		protected.GET("/servers/:id/stacks", stackHandler.ShowServerStacks)
		protected.GET("/servers/:serverid/stacks/:stackname", stackHandler.ShowStackDetails)
	}
	if maintenanceHandler != nil {
		protected.GET("/servers/:serverid/maintenance", maintenanceHandler.ShowMaintenance)
	}
	if registryHandler != nil {
		protected.GET("/servers/:serverid/registries", registryHandler.ShowRegistries)
	}
	if operationLogsHandler != nil {
		protected.GET("/operation-logs", operationLogsHandler.ShowUserOperationLogs)
	}
	if sessionHandler != nil {
		protected.GET("/sessions", sessionHandler.Sessions)
	}
	if apiKeyHandler != nil {
		protected.GET("/api-keys", apiKeyHandler.ShowAPIKeys)
		protected.GET("/api-keys/:id/scopes", apiKeyHandler.ShowAPIKeyScopes)
	}
	protected.GET("/auth/totp/setup", totpHandler.ShowSetup)
}

func registerAdminWebRoutes(web *echo.Group, rbacMiddleware *rbac.Middleware, inertiaService *inertia.Service,
	rbacHandler *rbac.Handler, operationLogsHandler *operationlogs.Handler, serverHandler *server.Handler,
	migrationHandler *migration.Handler, securityHandler *security.Handler) {

	if rbacHandler == nil || rbacMiddleware == nil {
		return
	}

	admin := web.Group("/admin")
	admin.Use(rbacMiddleware.RequireRole("admin"))

	// Inertia Pages
	admin.GET("/users", rbacHandler.ListUsers)
	admin.GET("/users/:id/roles", rbacHandler.ShowUserRoles)
	admin.GET("/roles", rbacHandler.ListRoles)
	admin.GET("/roles/:id/stack-permissions", rbacHandler.RoleServerStackPermissions)
	if serverHandler != nil {
		admin.GET("/servers", serverHandler.Index)
		admin.GET("/servers/:id", serverHandler.Show)
	}
	if migrationHandler != nil {
		admin.GET("/migration", migrationHandler.Index)
	}
	admin.GET("/agent-update", func(c echo.Context) error {
		return inertiaService.Render(c, "Admin/AgentUpdate", map[string]any{
			"title": "Agent Updates",
		})
	})
	if operationLogsHandler != nil {
		admin.GET("/operation-logs", operationLogsHandler.ShowOperationLogs)
	}
	if securityHandler != nil {
		admin.GET("/security-audit-logs", func(c echo.Context) error {
			return inertiaService.Render(c, "Admin/SecurityAuditLogs", map[string]any{
				"title": "Security Audit Logs",
			})
		})
	}
}

func registerWebUIWebSocketRoutes(srv *brxserver.Server, sessionManager *session.Manager, wsHandler *websocket.Handler, operationsWSHandler *operations.WebSocketHandler) {
	if wsHandler == nil {
		return
	}

	wsGroup := srv.Group("/ws")
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
}

// ============================================================================
// API ROUTE HELPERS
// ============================================================================

func registerAPIAuthRoutes(api *echo.Group, authApiRateLimit echo.MiddlewareFunc, mobileAuthHandler *handlers.MobileAuthHandler) {
	authApi := api.Group("/auth")
	authApi.Use(authApiRateLimit)

	authApi.POST("/login", mobileAuthHandler.Login)
	authApi.POST("/refresh", mobileAuthHandler.RefreshToken)
	authApi.POST("/totp/verify", mobileAuthHandler.VerifyTOTP)
}

func registerProtectedAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *jwtservice.Service, apiKeySvc *apikey.Service, userProvider jwtshared.UserProvider,
	rbacMiddleware *rbac.Middleware, mobileAuthHandler *handlers.MobileAuthHandler, serverUserAPIHandler *server.UserAPIHandler,
	stackAPIHandler *stack.APIHandler, filesAPIHandler *files.APIHandler, logsHandler *logs.Handler,
	operationsHandler *operations.Handler, operationLogsHandler *operationlogs.Handler, maintenanceAPIHandler *maintenance.APIHandler,
	vulnscanHandler *vulnscan.Handler, imageUpdatesAPIHandler *imageupdates.APIHandler, apiKeyHandler *apikey.Handler,
	versionHandler *handlers.VersionHandler, registryAPIHandler *registry.APIHandler) {

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(berthauth.RequireHybridAuth(jwtSvc, apiKeySvc, userProvider))

	// Version
	if versionHandler != nil {
		apiProtected.GET("/version", versionHandler.GetVersion)
	}

	// Profile (accessible via JWT, Session, or API Key)
	apiProtected.GET("/profile", mobileAuthHandler.Profile)
	apiProtected.POST("/auth/logout", mobileAuthHandler.Logout, rbacMiddleware.RequireAPIKeyDenied())

	// TOTP (JWT/Session only, API Key denied)
	apiProtected.GET("/totp/setup", mobileAuthHandler.GetTOTPSetup, rbacMiddleware.RequireAPIKeyDenied())
	apiProtected.POST("/totp/enable", mobileAuthHandler.EnableTOTP, rbacMiddleware.RequireAPIKeyDenied())
	apiProtected.POST("/totp/disable", mobileAuthHandler.DisableTOTP, rbacMiddleware.RequireAPIKeyDenied())
	apiProtected.GET("/totp/status", mobileAuthHandler.GetTOTPStatus, rbacMiddleware.RequireAPIKeyDenied())

	// Sessions (JWT/Session only, API Key denied)
	apiProtected.POST("/sessions", mobileAuthHandler.GetSessions, rbacMiddleware.RequireAPIKeyDenied())
	apiProtected.POST("/sessions/revoke", mobileAuthHandler.RevokeSession, rbacMiddleware.RequireAPIKeyDenied())
	apiProtected.POST("/sessions/revoke-all-others", mobileAuthHandler.RevokeAllOtherSessions, rbacMiddleware.RequireAPIKeyDenied())

	// Servers
	if serverUserAPIHandler != nil {
		apiProtected.GET("/servers", serverUserAPIHandler.ListServers, rbacMiddleware.RequireUserScopeJWT("servers.read"))
		apiProtected.GET("/servers/:serverid/statistics", serverUserAPIHandler.GetServerStatistics, rbacMiddleware.RequireUserScopeJWT("servers.read"))
	}

	// Stacks
	if stackAPIHandler != nil {
		apiProtected.GET("/servers/:serverid/stacks", stackAPIHandler.ListServerStacks)
		apiProtected.POST("/servers/:serverid/stacks", stackAPIHandler.CreateStack)
		apiProtected.GET("/servers/:serverid/stacks/can-create", stackAPIHandler.CheckCanCreateStack)
		apiProtected.GET("/servers/:serverid/stacks/:stackname", stackAPIHandler.GetStackDetails)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/permissions", stackAPIHandler.CheckPermissions)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/networks", stackAPIHandler.GetStackNetworks)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/volumes", stackAPIHandler.GetStackVolumes)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/environment", stackAPIHandler.GetStackEnvironmentVariables)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/images", stackAPIHandler.GetContainerImageDetails)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/compose", stackAPIHandler.GetComposeConfig)
		apiProtected.PATCH("/servers/:serverid/stacks/:stackname/compose", stackAPIHandler.UpdateCompose)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/stats", stackAPIHandler.GetStackStats)
	}

	// Vulnerability Scanning
	if vulnscanHandler != nil {
		apiProtected.POST("/servers/:serverid/stacks/:stackname/vulnscan", vulnscanHandler.StartScan)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/vulnscan", vulnscanHandler.GetLatestScanForStack)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/vulnscan/history", vulnscanHandler.GetScansForStack)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/vulnscan/trend", vulnscanHandler.GetScanTrend)
		apiProtected.GET("/vulnscan/:scanid", vulnscanHandler.GetScan)
		apiProtected.GET("/vulnscan/:scanid/summary", vulnscanHandler.GetScanSummary)
		apiProtected.GET("/vulnscan/compare/:baseScanId/:compareScanId", vulnscanHandler.CompareScans)
	}

	// Files
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

	// Logs
	if logsHandler != nil {
		apiProtected.GET("/servers/:serverid/stacks/:stackname/logs", logsHandler.GetStackLogs)
		apiProtected.GET("/servers/:serverid/stacks/:stackname/containers/:containerName/logs", logsHandler.GetContainerLogs)
	}

	// Operations
	if operationsHandler != nil {
		apiProtected.POST("/servers/:serverid/stacks/:stackname/operations", operationsHandler.StartOperation)
	}
	if operationLogsHandler != nil {
		apiProtected.GET("/operation-logs", operationLogsHandler.ListUserOperationLogs, rbacMiddleware.RequireUserScopeJWT("logs.operations.read"))
		apiProtected.GET("/operation-logs/stats", operationLogsHandler.GetUserOperationLogsStats, rbacMiddleware.RequireUserScopeJWT("logs.operations.read"))
		apiProtected.GET("/operation-logs/by-operation-id/:operationId", operationLogsHandler.GetOperationLogDetailsByOperationID, rbacMiddleware.RequireUserScopeJWT("logs.operations.read"))
		apiProtected.GET("/operation-logs/:id", operationLogsHandler.GetUserOperationLogDetails, rbacMiddleware.RequireUserScopeJWT("logs.operations.read"))
		apiProtected.GET("/running-operations", operationLogsHandler.GetRunningOperations, rbacMiddleware.RequireUserScopeJWT("logs.operations.read"))
	}

	// Maintenance
	if maintenanceAPIHandler != nil {
		apiProtected.GET("/servers/:serverid/maintenance/permissions", maintenanceAPIHandler.CheckPermissions)
		apiProtected.GET("/servers/:serverid/maintenance/info", maintenanceAPIHandler.GetSystemInfo)
		apiProtected.POST("/servers/:serverid/maintenance/prune", maintenanceAPIHandler.PruneDocker)
		apiProtected.DELETE("/servers/:serverid/maintenance/resource", maintenanceAPIHandler.DeleteResource)
	}

	// Image Updates
	if imageUpdatesAPIHandler != nil {
		apiProtected.GET("/image-updates", imageUpdatesAPIHandler.ListAvailableUpdates)
		apiProtected.GET("/servers/:serverid/image-updates", imageUpdatesAPIHandler.ListServerUpdates)
	}

	// API Keys
	if apiKeyHandler != nil {
		apiProtected.GET("/api-keys", apiKeyHandler.ListAPIKeys, rbacMiddleware.RequireAPIKeyDenied())
		apiProtected.GET("/api-keys/:id", apiKeyHandler.GetAPIKey, rbacMiddleware.RequireAPIKeyDenied())
		apiProtected.POST("/api-keys", apiKeyHandler.CreateAPIKey, rbacMiddleware.RequireAPIKeyDenied())
		apiProtected.DELETE("/api-keys/:id", apiKeyHandler.RevokeAPIKey, rbacMiddleware.RequireAPIKeyDenied())
		apiProtected.GET("/api-keys/:id/scopes", apiKeyHandler.ListScopes, rbacMiddleware.RequireAPIKeyDenied())
		apiProtected.POST("/api-keys/:id/scopes", apiKeyHandler.AddScope, rbacMiddleware.RequireAPIKeyDenied())
		apiProtected.DELETE("/api-keys/:id/scopes/:scopeId", apiKeyHandler.RemoveScope, rbacMiddleware.RequireAPIKeyDenied())
	}

	// Registry Credentials
	if registryAPIHandler != nil {
		apiProtected.GET("/servers/:serverid/registries", registryAPIHandler.ListCredentials)
		apiProtected.GET("/servers/:serverid/registries/:id", registryAPIHandler.GetCredential)
		apiProtected.POST("/servers/:serverid/registries", registryAPIHandler.CreateCredential)
		apiProtected.PUT("/servers/:serverid/registries/:id", registryAPIHandler.UpdateCredential)
		apiProtected.DELETE("/servers/:serverid/registries/:id", registryAPIHandler.DeleteCredential)
	}
}

func registerAdminAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *jwtservice.Service, apiKeySvc *apikey.Service, userProvider jwtshared.UserProvider,
	rbacMiddleware *rbac.Middleware, rbacAPIHandler *rbac.APIHandler, operationLogsHandler *operationlogs.Handler,
	serverAPIHandler *server.APIHandler, migrationHandler *migration.Handler, securityHandler *security.Handler) {

	if rbacAPIHandler == nil || rbacMiddleware == nil {
		return
	}

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(berthauth.RequireHybridAuth(jwtSvc, apiKeySvc, userProvider))

	apiAdmin := apiProtected.Group("/admin")

	// Users
	apiAdmin.GET("/users", rbacAPIHandler.ListUsers, rbacMiddleware.RequireAdminScopeJWT("admin.users.read"))
	apiAdmin.POST("/users", rbacAPIHandler.CreateUser, rbacMiddleware.RequireAdminScopeJWT("admin.users.write"))
	apiAdmin.GET("/users/:id/roles", rbacAPIHandler.GetUserRoles, rbacMiddleware.RequireAdminScopeJWT("admin.users.read"))
	apiAdmin.POST("/users/assign-role", rbacAPIHandler.AssignRole, rbacMiddleware.RequireAdminScopeJWT("admin.users.write"))
	apiAdmin.POST("/users/revoke-role", rbacAPIHandler.RevokeRole, rbacMiddleware.RequireAdminScopeJWT("admin.users.write"))

	// Roles
	apiAdmin.GET("/roles", rbacAPIHandler.ListRoles, rbacMiddleware.RequireAdminScopeJWT("admin.roles.read"))
	apiAdmin.POST("/roles", rbacAPIHandler.CreateRole, rbacMiddleware.RequireAdminScopeJWT("admin.roles.write"))
	apiAdmin.PUT("/roles/:id", rbacAPIHandler.UpdateRole, rbacMiddleware.RequireAdminScopeJWT("admin.roles.write"))
	apiAdmin.DELETE("/roles/:id", rbacAPIHandler.DeleteRole, rbacMiddleware.RequireAdminScopeJWT("admin.roles.write"))
	apiAdmin.GET("/roles/:roleId/stack-permissions", rbacAPIHandler.ListRoleServerStackPermissions, rbacMiddleware.RequireAdminScopeJWT("admin.roles.read"))
	apiAdmin.POST("/roles/:roleId/stack-permissions", rbacAPIHandler.CreateRoleStackPermission, rbacMiddleware.RequireAdminScopeJWT("admin.roles.write"))
	apiAdmin.DELETE("/roles/:roleId/stack-permissions/:permissionId", rbacAPIHandler.DeleteRoleStackPermission, rbacMiddleware.RequireAdminScopeJWT("admin.roles.write"))

	// Permissions
	apiAdmin.GET("/permissions", rbacAPIHandler.ListPermissions, rbacMiddleware.RequireAdminScopeJWT("admin.permissions.read"))

	// Operation Logs
	if operationLogsHandler != nil {
		apiAdmin.GET("/operation-logs", operationLogsHandler.ListOperationLogs, rbacMiddleware.RequireAdminScopeJWT("admin.logs.read"))
		apiAdmin.GET("/operation-logs/stats", operationLogsHandler.GetOperationLogsStats, rbacMiddleware.RequireAdminScopeJWT("admin.logs.read"))
		apiAdmin.GET("/operation-logs/:id", operationLogsHandler.GetOperationLogDetails, rbacMiddleware.RequireAdminScopeJWT("admin.logs.read"))
	}

	// Servers
	if serverAPIHandler != nil {
		apiAdmin.GET("/servers", serverAPIHandler.ListServers, rbacMiddleware.RequireAdminScopeJWT("admin.servers.read"))
		apiAdmin.GET("/servers/:id", serverAPIHandler.GetServer, rbacMiddleware.RequireAdminScopeJWT("admin.servers.read"))
		apiAdmin.POST("/servers", serverAPIHandler.CreateServer, rbacMiddleware.RequireAdminScopeJWT("admin.servers.write"))
		apiAdmin.PUT("/servers/:id", serverAPIHandler.UpdateServer, rbacMiddleware.RequireAdminScopeJWT("admin.servers.write"))
		apiAdmin.DELETE("/servers/:id", serverAPIHandler.DeleteServer, rbacMiddleware.RequireAdminScopeJWT("admin.servers.write"))
		apiAdmin.POST("/servers/:id/test", serverAPIHandler.TestConnection, rbacMiddleware.RequireAdminScopeJWT("admin.servers.write"))
	}

	// Migration
	if migrationHandler != nil {
		apiAdmin.POST("/migration/export", migrationHandler.Export, rbacMiddleware.RequireAdminScopeJWT("admin.system.export"))
		apiAdmin.POST("/migration/import", migrationHandler.Import, rbacMiddleware.RequireAdminScopeJWT("admin.system.import"))
	}

	// Security Audit
	if securityHandler != nil {
		apiAdmin.GET("/security-audit-logs", securityHandler.ListLogs, rbacMiddleware.RequireAdminScopeJWT("admin.audit.read"))
		apiAdmin.GET("/security-audit-logs/stats", securityHandler.GetStats, rbacMiddleware.RequireAdminScopeJWT("admin.audit.read"))
		apiAdmin.GET("/security-audit-logs/:id", securityHandler.GetLog, rbacMiddleware.RequireAdminScopeJWT("admin.audit.read"))
	}
}

func registerAPIWebSocketRoutes(srv *brxserver.Server, jwtSvc *jwtservice.Service, apiKeySvc *apikey.Service, userProvider jwtshared.UserProvider, wsHandler *websocket.Handler, operationsWSHandler *operations.WebSocketHandler) {
	if wsHandler == nil {
		return
	}

	wsGroup := srv.Group("/ws")
	wsAPIGroup := wsGroup.Group("/api")
	wsAPIGroup.Use(berthauth.RequireAuth(jwtSvc, apiKeySvc, userProvider))

	wsAPIGroup.GET("/stack-status/:server_id", wsHandler.HandleFlutterWebSocket)
	wsAPIGroup.GET("/servers/:serverid/terminal", wsHandler.HandleFlutterTerminalWebSocket)

	if operationsWSHandler != nil {
		wsAPIGroup.GET("/servers/:serverid/stacks/:stackname/operations", operationsWSHandler.HandleOperationWebSocket)
		wsAPIGroup.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", operationsWSHandler.HandleOperationWebSocket)
	}
}
