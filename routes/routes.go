package routes

import (
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
	"go.uber.org/fx"
)

type RouteParams struct {
	fx.In

	Srv                    *brxserver.Server
	DashboardHandler       *handlers.DashboardHandler
	StacksHandler          *handlers.StacksHandler
	AuthHandler            *handlers.AuthHandler
	MobileAuthHandler      *handlers.MobileAuthHandler
	SessionHandler         *handlers.SessionHandler
	TOTPHandler            *handlers.TOTPHandler
	VersionHandler         *handlers.VersionHandler
	MigrationHandler       *migration.Handler
	OperationLogsHandler   *operationlogs.Handler
	RBACHandler            *rbac.Handler
	RBACAPIHandler         *rbac.APIHandler
	RBACMiddleware         *rbac.Middleware
	SetupHandler           *setup.Handler
	ServerHandler          *server.Handler
	ServerAPIHandler       *server.APIHandler
	ServerUserAPIHandler   *server.UserAPIHandler
	StackHandler           *stack.Handler
	StackAPIHandler        *stack.APIHandler
	MaintenanceHandler     *maintenance.Handler
	MaintenanceAPIHandler  *maintenance.APIHandler
	FilesAPIHandler        *files.APIHandler
	LogsHandler            *logs.Handler
	OperationsHandler      *operations.Handler
	OperationsWSHandler    *operations.WebSocketHandler
	RegistryHandler        *registry.Handler
	RegistryAPIHandler     *registry.APIHandler
	WSHandler              *websocket.Handler
	SecurityHandler        *security.Handler
	APIKeyHandler          *apikey.Handler
	APIKeySvc              *apikey.Service
	ImageUpdatesAPIHandler *imageupdates.APIHandler
	VulnscanHandler        *vulnscan.Handler
	SessionManager         *session.Manager
	SessionService         session.SessionService
	RateLimitStore         ratelimit.Store
	InertiaService         *inertia.Service
	JWTSvc                 *jwtservice.Service
	UserProvider           jwtshared.UserProvider
	AuthSvc                *auth.Service
	TOTPSvc                *totp.Service
	Logger                 *logging.Service
	Cfg                    *config.Config
}

func RegisterRoutes(p RouteParams) {
	if p.RBACMiddleware != nil && p.APIKeySvc != nil {
		p.RBACMiddleware.SetAPIKeyService(p.APIKeySvc)
	}

	e := p.Srv.Echo()
	e.Use(middleware.Recover())
	handlers.SetupErrorHandler(e, p.InertiaService)

	// ============================================================================
	// PUBLIC ROUTES
	// ============================================================================

	p.Srv.Get("/build/*", echo.WrapHandler(http.StripPrefix("/build/", http.FileServer(http.Dir("public/build")))))

	if p.SetupHandler != nil {
		p.Srv.Get("/setup/admin", p.SetupHandler.ShowSetup)
		p.Srv.Post("/setup/admin", p.SetupHandler.CreateAdmin)
	}

	// ============================================================================
	// WEB UI ROUTES - Session Auth Only
	// ============================================================================

	web := p.Srv.Group("")
	web.Use(session.Middleware(p.SessionManager))
	if p.SessionService != nil {
		web.Use(session.SessionServiceMiddleware(p.SessionService))
	}
	web.Use(rememberme.Middleware(rememberme.Config{
		AuthService:  p.AuthSvc,
		UserProvider: p.UserProvider,
		TOTPService:  p.TOTPSvc,
		Logger:       p.Logger,
	}))
	if p.Cfg.CSRF.Enabled {
		web.Use(csrf.WithConfig(&p.Cfg.CSRF))
		web.Use(inertiacsrf.Middleware(p.Cfg))
	}
	if p.InertiaService != nil {
		web.Use(p.InertiaService.Middleware())
		web.Use(inertiashared.MiddlewareWithConfig(inertiashared.Config{
			AuthEnabled:  true,
			FlashEnabled: true,
			UserProvider: p.UserProvider,
		}))
	}

	registerAuthRoutes(web, p.AuthHandler, p.TOTPHandler, p.RateLimitStore)
	registerProtectedWebRoutes(web,
		p.DashboardHandler, p.StacksHandler, p.AuthHandler, p.SessionHandler, p.TOTPHandler,
		p.VersionHandler, p.StackHandler, p.MaintenanceHandler, p.RegistryHandler,
		p.OperationLogsHandler, p.APIKeyHandler,
		p.RegistryAPIHandler)
	registerAdminWebRoutes(web, p.RBACMiddleware, p.InertiaService,
		p.RBACHandler, p.OperationLogsHandler, p.ServerHandler,
		p.MigrationHandler, p.SecurityHandler)
	registerWebUIWebSocketRoutes(p.Srv, p.SessionManager, p.WSHandler, p.OperationsWSHandler)

	// ============================================================================
	// API ROUTES - Hybrid Auth (Session OR JWT OR API Key)
	// ============================================================================

	if p.MobileAuthHandler != nil && p.JWTSvc != nil {
		api := p.Srv.Group("/api/v1")
		api.Use(session.Middleware(p.SessionManager))
		if p.SessionService != nil {
			api.Use(session.SessionServiceMiddleware(p.SessionService))
		}
		if p.Cfg.CSRF.Enabled {
			api.Use(berthauth.ConditionalCSRFMiddleware(p.Cfg))
		}

		authApiRateLimit := ratelimit.WithConfig(&ratelimit.Config{
			Store:        p.RateLimitStore,
			Rate:         25,
			Period:       time.Minute,
			CountMode:    config.CountFailures,
			KeyGenerator: ratelimit.SecureKeyGenerator,
		})

		generalApiRateLimit := ratelimit.WithConfig(&ratelimit.Config{
			Store:        p.RateLimitStore,
			Rate:         1000,
			Period:       time.Minute * 10,
			CountMode:    config.CountAll,
			KeyGenerator: ratelimit.DefaultKeyGenerator,
		})

		registerAPIAuthRoutes(api, authApiRateLimit, p.MobileAuthHandler)
		registerProtectedAPIRoutes(api, generalApiRateLimit, p.JWTSvc, p.APIKeySvc, p.UserProvider,
			p.RBACMiddleware, p.MobileAuthHandler, p.ServerUserAPIHandler,
			p.StackAPIHandler, p.FilesAPIHandler, p.LogsHandler, p.OperationsHandler,
			p.OperationLogsHandler, p.MaintenanceAPIHandler, p.VulnscanHandler,
			p.ImageUpdatesAPIHandler, p.APIKeyHandler, p.VersionHandler, p.RegistryAPIHandler)
		registerAdminAPIRoutes(api, generalApiRateLimit, p.JWTSvc, p.APIKeySvc, p.UserProvider,
			p.RBACMiddleware, p.RBACAPIHandler, p.OperationLogsHandler,
			p.ServerAPIHandler, p.MigrationHandler, p.SecurityHandler)
		registerAPIWebSocketRoutes(p.Srv, p.JWTSvc, p.APIKeySvc, p.UserProvider, p.WSHandler, p.OperationsWSHandler)
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
	admin.Use(rbacMiddleware.RequireRole(rbac.RoleAdmin))

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

func requireWebSocketAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !session.IsAuthenticated(c) {
				return c.JSON(401, map[string]string{"error": "Not authenticated"})
			}
			if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
				return c.JSON(401, map[string]string{"error": "TOTP verification required"})
			}
			return next(c)
		}
	}
}

func registerWebUIWebSocketRoutes(srv *brxserver.Server, sessionManager *session.Manager, wsHandler *websocket.Handler, operationsWSHandler *operations.WebSocketHandler) {
	if wsHandler == nil {
		return
	}

	wsGroup := srv.Group("/ws")
	wsUIGroup := wsGroup.Group("/ui")
	wsUIGroup.Use(session.Middleware(sessionManager))
	wsUIGroup.Use(requireWebSocketAuth())

	wsUIGroup.GET("/stack-status/:server_id", wsHandler.HandleWebUIWebSocket)
	wsUIGroup.GET("/servers/:serverid/terminal", wsHandler.HandleWebUITerminalWebSocket)

	if operationsWSHandler != nil {
		wsUIGroup.GET("/servers/:serverid/stacks/:stackname/operations", operationsWSHandler.HandleOperationWebSocket)
		wsUIGroup.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", operationsWSHandler.HandleOperationWebSocket)
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
		apiProtected.GET("/servers", serverUserAPIHandler.ListServers, rbacMiddleware.RequireUserScopeJWT(rbac.PermServersRead))
		apiProtected.GET("/servers/:serverid/statistics", serverUserAPIHandler.GetServerStatistics, rbacMiddleware.RequireUserScopeJWT(rbac.PermServersRead))
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
		apiProtected.GET("/operation-logs", operationLogsHandler.ListUserOperationLogs, rbacMiddleware.RequireUserScopeJWT(rbac.PermLogsOperationsRead))
		apiProtected.GET("/operation-logs/stats", operationLogsHandler.GetUserOperationLogsStats, rbacMiddleware.RequireUserScopeJWT(rbac.PermLogsOperationsRead))
		apiProtected.GET("/operation-logs/by-operation-id/:operationId", operationLogsHandler.GetOperationLogDetailsByOperationID, rbacMiddleware.RequireUserScopeJWT(rbac.PermLogsOperationsRead))
		apiProtected.GET("/operation-logs/:id", operationLogsHandler.GetUserOperationLogDetails, rbacMiddleware.RequireUserScopeJWT(rbac.PermLogsOperationsRead))
		apiProtected.GET("/running-operations", operationLogsHandler.GetRunningOperations, rbacMiddleware.RequireUserScopeJWT(rbac.PermLogsOperationsRead))
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
	apiAdmin.GET("/users", rbacAPIHandler.ListUsers, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminUsersRead))
	apiAdmin.POST("/users", rbacAPIHandler.CreateUser, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminUsersWrite))
	apiAdmin.GET("/users/:id/roles", rbacAPIHandler.GetUserRoles, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminUsersRead))
	apiAdmin.POST("/users/assign-role", rbacAPIHandler.AssignRole, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminUsersWrite))
	apiAdmin.POST("/users/revoke-role", rbacAPIHandler.RevokeRole, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminUsersWrite))

	// Roles
	apiAdmin.GET("/roles", rbacAPIHandler.ListRoles, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminRolesRead))
	apiAdmin.POST("/roles", rbacAPIHandler.CreateRole, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminRolesWrite))
	apiAdmin.PUT("/roles/:id", rbacAPIHandler.UpdateRole, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminRolesWrite))
	apiAdmin.DELETE("/roles/:id", rbacAPIHandler.DeleteRole, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminRolesWrite))
	apiAdmin.GET("/roles/:roleId/stack-permissions", rbacAPIHandler.ListRoleServerStackPermissions, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminRolesRead))
	apiAdmin.POST("/roles/:roleId/stack-permissions", rbacAPIHandler.CreateRoleStackPermission, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminRolesWrite))
	apiAdmin.DELETE("/roles/:roleId/stack-permissions/:permissionId", rbacAPIHandler.DeleteRoleStackPermission, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminRolesWrite))

	// Permissions
	apiAdmin.GET("/permissions", rbacAPIHandler.ListPermissions, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminPermissionsRead))

	// Operation Logs
	if operationLogsHandler != nil {
		apiAdmin.GET("/operation-logs", operationLogsHandler.ListOperationLogs, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminLogsRead))
		apiAdmin.GET("/operation-logs/stats", operationLogsHandler.GetOperationLogsStats, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminLogsRead))
		apiAdmin.GET("/operation-logs/:id", operationLogsHandler.GetOperationLogDetails, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminLogsRead))
	}

	// Servers
	if serverAPIHandler != nil {
		apiAdmin.GET("/servers", serverAPIHandler.ListServers, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersRead))
		apiAdmin.GET("/servers/:id", serverAPIHandler.GetServer, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersRead))
		apiAdmin.POST("/servers", serverAPIHandler.CreateServer, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersWrite))
		apiAdmin.PUT("/servers/:id", serverAPIHandler.UpdateServer, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersWrite))
		apiAdmin.DELETE("/servers/:id", serverAPIHandler.DeleteServer, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersWrite))
		apiAdmin.POST("/servers/:id/test", serverAPIHandler.TestConnection, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersWrite))
	}

	// Migration
	if migrationHandler != nil {
		apiAdmin.POST("/migration/export", migrationHandler.Export, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminSystemExport))
		apiAdmin.POST("/migration/import", migrationHandler.Import, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminSystemImport))
	}

	// Security Audit
	if securityHandler != nil {
		apiAdmin.GET("/security-audit-logs", securityHandler.ListLogs, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminAuditRead))
		apiAdmin.GET("/security-audit-logs/stats", securityHandler.GetStats, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminAuditRead))
		apiAdmin.GET("/security-audit-logs/:id", securityHandler.GetLog, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminAuditRead))
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
