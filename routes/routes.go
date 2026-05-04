package routes

import (
	"net/http"
	"time"

	"berth/internal/domain/apikey"
	"berth/internal/domain/auth"
	"berth/internal/domain/dashboard"
	"berth/internal/domain/dataexport"
	"berth/internal/domain/files"
	"berth/internal/domain/imageupdates"
	"berth/internal/domain/logs"
	"berth/internal/domain/maintenance"
	"berth/internal/domain/operationlogs"
	"berth/internal/domain/operations"
	"berth/internal/domain/rbac"
	"berth/internal/domain/registry"
	"berth/internal/domain/security"
	"berth/internal/domain/server"
	"berth/internal/domain/setup"
	"berth/internal/domain/stack"
	"berth/internal/domain/version"
	"berth/internal/domain/vulnscan"
	"berth/internal/domain/websocket"
	"berth/internal/platform/httperr"

	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/auth/totp"
	"berth/internal/domain/session"
	"berth/internal/pkg/config"
	"berth/internal/pkg/response"
	"berth/internal/platform/inertia"
	"berth/internal/platform/middleware/ratelimit"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"go.uber.org/zap"
)

type RouteParams struct {
	Srv                    *echo.Echo
	DashboardHandler       *dashboard.Handler
	AuthHandler            *auth.Handler
	MobileAuthHandler      *auth.APIHandler
	SessionHandler         *session.Handler
	TOTPHandler            *auth.TOTPHandler
	VersionHandler         *version.Handler
	MigrationHandler       *dataexport.Handler
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
	SessionService         *session.Service
	RateLimitStore         *ratelimit.Store
	InertiaService         *inertia.Service
	JWTSvc                 *tokens.Service
	UserProvider           auth.UserProvider
	AuthSvc                *auth.Service
	TOTPSvc                *totp.Service
	Logger                 *zap.Logger
	Cfg                    *config.Config
}

func newRateLimit(cfg *config.Config, rlc ratelimit.Config) echo.MiddlewareFunc {
	if !cfg.RateLimit.Enabled {
		return func(next echo.HandlerFunc) echo.HandlerFunc { return next }
	}
	return ratelimit.New(rlc)
}

func RegisterRoutes(p RouteParams) {
	if p.RBACMiddleware != nil && p.APIKeySvc != nil {
		p.RBACMiddleware.SetAPIKeyService(p.APIKeySvc)
	}

	e := p.Srv
	e.Use(middleware.Recover())
	e.Use(middleware.SecureWithConfig(middleware.SecureConfig{
		XSSProtection:      "0",
		ContentTypeNosniff: "nosniff",
		XFrameOptions:      "DENY",
		HSTSMaxAge:         31536000,
		ReferrerPolicy:     "strict-origin-when-cross-origin",
	}))
	httperr.SetupErrorHandler(e, p.InertiaService)

	// ============================================================================
	// PUBLIC ROUTES
	// ============================================================================

	p.Srv.GET("/build/*", echo.WrapHandler(http.StripPrefix("/build/", http.FileServer(http.Dir("public/build")))))

	if p.SetupHandler != nil {
		p.SetupHandler.RegisterPublicRoutes(p.Srv)
	}

	// ============================================================================
	// WEB UI ROUTES - Session Auth Only
	// ============================================================================

	web := p.Srv.Group("")
	web.Use(session.Middleware(p.SessionManager))
	if p.SessionService != nil {
		web.Use(session.TrackingMiddleware(p.SessionService))
	}
	web.Use(auth.RememberMeMiddleware(auth.RememberMeConfig{
		AuthService:  p.AuthSvc,
		UserProvider: p.UserProvider,
		TOTPService:  p.TOTPSvc,
		Logger:       p.Logger,
	}))
	if p.Cfg.CSRF.Enabled {
		web.Use(auth.CSRFMiddleware(&p.Cfg.CSRF))
		web.Use(inertia.CSRFContext(p.Cfg.CSRF.ContextKey))
	}
	if p.InertiaService != nil {
		web.Use(p.InertiaService.Middleware())
		web.Use(inertia.SharedContext(
			p.UserProvider.GetUser,
			session.IsAuthenticated,
			session.GetUserIDAsUint,
			func(c echo.Context) any {
				if msgs := session.GetFlashMessages(c); msgs != nil {
					return msgs
				}
				return nil
			},
		))
	}

	registerAuthRoutes(web, p.Cfg, p.AuthHandler, p.TOTPHandler, p.RateLimitStore)
	registerProtectedWebRoutes(web,
		p.DashboardHandler, p.AuthHandler, p.SessionHandler, p.TOTPHandler,
		p.StackHandler, p.MaintenanceHandler, p.RegistryHandler,
		p.OperationLogsHandler, p.APIKeyHandler)
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
			api.Use(session.TrackingMiddleware(p.SessionService))
		}
		if p.Cfg.CSRF.Enabled {
			api.Use(auth.ConditionalCSRFMiddleware(p.Cfg))
		}

		authApiRateLimit := newRateLimit(p.Cfg, ratelimit.Config{
			Store:     p.RateLimitStore,
			Name:      "api_auth",
			Rate:      25,
			Period:    time.Minute,
			CountMode: ratelimit.CountNon2xx,
			KeyFunc:   ratelimit.KeyByIP,
		})

		generalApiRateLimit := newRateLimit(p.Cfg, ratelimit.Config{
			Store:     p.RateLimitStore,
			Name:      "api_general",
			Rate:      1000,
			Period:    time.Minute * 10,
			CountMode: ratelimit.CountAll,
			KeyFunc:   ratelimit.KeyByIP,
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

func registerAuthRoutes(web *echo.Group, cfg *config.Config, authHandler *auth.Handler, totpHandler *auth.TOTPHandler, rateLimitStore *ratelimit.Store) {
	authGroup := web.Group("/auth")
	authGroup.Use(newRateLimit(cfg, ratelimit.Config{
		Store:     rateLimitStore,
		Name:      "web_auth_group",
		Rate:      60,
		Period:    time.Minute,
		CountMode: ratelimit.CountAll,
		KeyFunc:   ratelimit.KeyByIP,
	}))

	tightAuth := func(name string, rate int) echo.MiddlewareFunc {
		return newRateLimit(cfg, ratelimit.Config{
			Store:     rateLimitStore,
			Name:      name,
			Rate:      rate,
			Period:    time.Minute,
			CountMode: ratelimit.CountNon2xx,
			KeyFunc:   ratelimit.KeyByIP,
		})
	}

	authHandler.RegisterPublicWebAuthRoutes(authGroup, tightAuth)
	totpHandler.RegisterPublicWebAuthRoutes(authGroup, tightAuth)
}

func registerProtectedWebRoutes(web *echo.Group,
	dashboardHandler *dashboard.Handler, authHandler *auth.Handler,
	sessionHandler *session.Handler, totpHandler *auth.TOTPHandler,
	stackHandler *stack.Handler, maintenanceHandler *maintenance.Handler,
	registryHandler *registry.Handler, operationLogsHandler *operationlogs.Handler,
	apiKeyHandler *apikey.Handler) {

	protected := web.Group("")
	protected.Use(session.RequireAuthWeb("/auth/login"))
	protected.Use(session.RequireTOTPWeb("/auth/totp/verify"))

	dashboardHandler.RegisterProtectedWebRoutes(protected)
	authHandler.RegisterProtectedWebRoutes(protected)
	if stackHandler != nil {
		stackHandler.RegisterProtectedWebRoutes(protected)
	}
	if maintenanceHandler != nil {
		maintenanceHandler.RegisterProtectedWebRoutes(protected)
	}
	if registryHandler != nil {
		registryHandler.RegisterProtectedWebRoutes(protected)
	}
	if operationLogsHandler != nil {
		operationLogsHandler.RegisterProtectedWebRoutes(protected)
	}
	if sessionHandler != nil {
		sessionHandler.RegisterProtectedWebRoutes(protected)
	}
	if apiKeyHandler != nil {
		apiKeyHandler.RegisterProtectedWebRoutes(protected)
	}
	totpHandler.RegisterProtectedWebRoutes(protected)
}

func registerAdminWebRoutes(web *echo.Group, rbacMiddleware *rbac.Middleware, inertiaService *inertia.Service,
	rbacHandler *rbac.Handler, operationLogsHandler *operationlogs.Handler, serverHandler *server.Handler,
	migrationHandler *dataexport.Handler, securityHandler *security.Handler) {

	if rbacHandler == nil || rbacMiddleware == nil {
		return
	}

	admin := web.Group("/admin")
	admin.Use(rbacMiddleware.RequireRole(rbac.RoleAdmin))

	rbacHandler.RegisterAdminWebRoutes(admin)
	if serverHandler != nil {
		serverHandler.RegisterAdminWebRoutes(admin)
	}
	if migrationHandler != nil {
		migrationHandler.RegisterAdminWebRoutes(admin)
	}
	admin.GET("/agent-update", func(c echo.Context) error {
		return inertiaService.Render(c, "Admin/AgentUpdate", map[string]any{
			"title": "Agent Updates",
		})
	})
	if operationLogsHandler != nil {
		operationLogsHandler.RegisterAdminWebRoutes(admin)
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
				return response.Unauthorized(c, "Not authenticated")
			}
			if session.IsTOTPEnabled(c) && !session.IsTOTPVerified(c) {
				return response.Unauthorized(c, "TOTP verification required")
			}
			return next(c)
		}
	}
}

func registerWebUIWebSocketRoutes(srv *echo.Echo, sessionManager *session.Manager, wsHandler *websocket.Handler, operationsWSHandler *operations.WebSocketHandler) {
	if wsHandler == nil {
		return
	}

	wsGroup := srv.Group("/ws")
	wsUIGroup := wsGroup.Group("/ui")
	wsUIGroup.Use(session.Middleware(sessionManager))
	wsUIGroup.Use(requireWebSocketAuth())

	wsHandler.RegisterWebUIRoutes(wsUIGroup)

	if operationsWSHandler != nil {
		operationsWSHandler.RegisterWebSocketRoutes(wsUIGroup)
	}
}

// ============================================================================
// API ROUTE HELPERS
// ============================================================================

func registerAPIAuthRoutes(api *echo.Group, authApiRateLimit echo.MiddlewareFunc, mobileAuthHandler *auth.APIHandler) {
	authApi := api.Group("/auth")
	authApi.Use(authApiRateLimit)
	mobileAuthHandler.RegisterPublicAPIRoutes(authApi)
}

func registerProtectedAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider,
	rbacMiddleware *rbac.Middleware, mobileAuthHandler *auth.APIHandler, serverUserAPIHandler *server.UserAPIHandler,
	stackAPIHandler *stack.APIHandler, filesAPIHandler *files.APIHandler, logsHandler *logs.Handler,
	operationsHandler *operations.Handler, operationLogsHandler *operationlogs.Handler, maintenanceAPIHandler *maintenance.APIHandler,
	vulnscanHandler *vulnscan.Handler, imageUpdatesAPIHandler *imageupdates.APIHandler, apiKeyHandler *apikey.Handler,
	versionHandler *version.Handler, registryAPIHandler *registry.APIHandler) {

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(auth.RequireHybridAuth(jwtSvc, apiKeySvc, userProvider))

	if versionHandler != nil {
		versionHandler.RegisterAPIRoutes(apiProtected)
	}

	mobileAuthHandler.RegisterProtectedAPIRoutes(apiProtected, rbacMiddleware.RequireAPIKeyDenied())

	if serverUserAPIHandler != nil {
		serverUserAPIHandler.RegisterProtectedAPIRoutes(apiProtected, rbacMiddleware.RequireUserScopeJWT(rbac.PermServersRead))
	}
	if stackAPIHandler != nil {
		stackAPIHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
	if vulnscanHandler != nil {
		vulnscanHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
	if filesAPIHandler != nil {
		filesAPIHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
	if logsHandler != nil {
		logsHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
	if operationsHandler != nil {
		operationsHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
	if operationLogsHandler != nil {
		operationLogsHandler.RegisterProtectedAPIRoutes(apiProtected, rbacMiddleware.RequireUserScopeJWT(rbac.PermLogsOperationsRead))
	}
	if maintenanceAPIHandler != nil {
		maintenanceAPIHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
	if imageUpdatesAPIHandler != nil {
		imageUpdatesAPIHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
	if apiKeyHandler != nil {
		apiKeyHandler.RegisterProtectedAPIRoutes(apiProtected, rbacMiddleware.RequireAPIKeyDenied())
	}
	if registryAPIHandler != nil {
		registryAPIHandler.RegisterProtectedAPIRoutes(apiProtected)
	}
}

func registerAdminAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider,
	rbacMiddleware *rbac.Middleware, rbacAPIHandler *rbac.APIHandler, operationLogsHandler *operationlogs.Handler,
	serverAPIHandler *server.APIHandler, migrationHandler *dataexport.Handler, securityHandler *security.Handler) {

	if rbacAPIHandler == nil || rbacMiddleware == nil {
		return
	}

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(auth.RequireHybridAuth(jwtSvc, apiKeySvc, userProvider))

	apiAdmin := apiProtected.Group("/admin")

	rbacAPIHandler.RegisterAdminAPIRoutes(apiAdmin, rbacMiddleware)
	if operationLogsHandler != nil {
		operationLogsHandler.RegisterAdminAPIRoutes(apiAdmin, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminLogsRead))
	}
	if serverAPIHandler != nil {
		serverAPIHandler.RegisterAdminAPIRoutes(apiAdmin,
			rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersRead),
			rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminServersWrite))
	}
	if migrationHandler != nil {
		migrationHandler.RegisterAdminAPIRoutes(apiAdmin,
			rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminSystemExport),
			rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminSystemImport))
	}
	if securityHandler != nil {
		securityHandler.RegisterAdminAPIRoutes(apiAdmin, rbacMiddleware.RequireAdminScopeJWT(rbac.PermAdminAuditRead))
	}
}

func registerAPIWebSocketRoutes(srv *echo.Echo, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider, wsHandler *websocket.Handler, operationsWSHandler *operations.WebSocketHandler) {
	if wsHandler == nil {
		return
	}

	wsGroup := srv.Group("/ws")
	wsAPIGroup := wsGroup.Group("/api")
	wsAPIGroup.Use(auth.RequireAuth(jwtSvc, apiKeySvc, userProvider))

	wsHandler.RegisterAPIRoutes(wsAPIGroup)

	if operationsWSHandler != nil {
		operationsWSHandler.RegisterWebSocketRoutes(wsAPIGroup)
	}
}
