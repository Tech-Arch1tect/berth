package app

import (
	"net/http"
	"time"

	"berth/internal/domain/apikey"
	"berth/internal/domain/auth"
	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/authz"
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
	"berth/internal/domain/stack"
	"berth/internal/domain/version"
	"berth/internal/domain/vulnscan"
	"berth/internal/domain/websocket"
	"berth/internal/pkg/config"
	"berth/internal/platform/httperr"
	"berth/internal/platform/middleware/ratelimit"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"go.uber.org/zap"
)

func newRateLimit(cfg *config.Config, rlc ratelimit.Config) echo.MiddlewareFunc {
	if !cfg.RateLimit.Enabled {
		return func(next echo.HandlerFunc) echo.HandlerFunc { return next }
	}
	return ratelimit.New(rlc)
}

func registerRoutes(g *Graph) {
	if g.RBACMid != nil && g.APIKeySvc != nil {
		g.RBACMid.SetAPIKeyService(g.APIKeySvc)
	}

	e := g.Echo
	e.Use(middleware.Recover())
	e.Use(middleware.SecureWithConfig(middleware.SecureConfig{
		XSSProtection:      "0",
		ContentTypeNosniff: "nosniff",
		XFrameOptions:      "DENY",
		HSTSMaxAge:         31536000,
		ReferrerPolicy:     "strict-origin-when-cross-origin",
	}))
	httperr.SetupErrorHandler(e)

	e.GET("/build/*", echo.WrapHandler(http.StripPrefix("/build/", http.FileServer(http.Dir("public/build")))))

	if g.AuthAPIHandler == nil || g.JWTSvc == nil {
		return
	}

	api := e.Group("/api/v1")

	authApiRateLimit := newRateLimit(g.Cfg, ratelimit.Config{
		Store:     g.RateLimit,
		Name:      "api_auth",
		Rate:      25,
		Period:    time.Minute,
		CountMode: ratelimit.CountNon2xx,
		KeyFunc:   ratelimit.KeyByIP,
	})

	generalApiRateLimit := newRateLimit(g.Cfg, ratelimit.Config{
		Store:     g.RateLimit,
		Name:      "api_general",
		Rate:      1000,
		Period:    time.Minute * 10,
		CountMode: ratelimit.CountAll,
		KeyFunc:   ratelimit.KeyByIP,
	})

	authzEngine := authz.NewEngine(g.DB, g.Logger)

	registerAPIAuthRoutes(api, authApiRateLimit, g.AuthAPIHandler)
	stackRegistrar := registerProtectedAPIRoutes(api, generalApiRateLimit, g.JWTSvc, g.APIKeySvc, g.AuthUserProv,
		g.RBACMid, g.AuthAPIHandler, g.ServerUserAPIHandler, authzEngine,
		g.StackAPIHandler, g.FilesAPIHandler, g.LogsHandler, g.OperationsHandler,
		g.OperationLogsHandler, g.MaintAPIHandler, g.VulnscanHandler,
		g.ImageUpdatesAPIHandler, g.APIKeyHandler, g.VersionHandler, g.RegistryAPIHandler)
	registerAdminAPIRoutes(api, generalApiRateLimit, g.JWTSvc, g.APIKeySvc, g.AuthUserProv,
		g.RBACMid, g.RBACAPIHandler, g.OperationLogsHandler,
		g.ServerAPIHandler, g.DataExportHandler, g.SecurityHandler)
	registerAPIWebSocketRoutes(e, g.JWTSvc, g.APIKeySvc, g.AuthUserProv, g.WSHandler, g.OperationsWSHandler)

	if err := authz.AuditRoutes(e, stackRegistrar); err != nil {
		g.Logger.Warn("authz audit: unguarded routes detected", zap.Error(err))
	}

	if g.SPASvc != nil {
		e.GET("/*", g.SPASvc.Render)
	}
}

func registerAPIAuthRoutes(api *echo.Group, authApiRateLimit echo.MiddlewareFunc, mobileAuthHandler *auth.APIHandler) {
	authApi := api.Group("/auth")
	authApi.Use(authApiRateLimit)
	mobileAuthHandler.RegisterPublicAPIRoutes(authApi)
}

func registerProtectedAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider,
	rbacMiddleware *rbac.Middleware, mobileAuthHandler *auth.APIHandler, serverUserAPIHandler *server.UserAPIHandler,
	authzEngine *authz.Engine, stackAPIHandler *stack.APIHandler, filesAPIHandler *files.APIHandler, logsHandler *logs.Handler,
	operationsHandler *operations.Handler, operationLogsHandler *operationlogs.Handler, maintenanceAPIHandler *maintenance.APIHandler,
	vulnscanHandler *vulnscan.Handler, imageUpdatesAPIHandler *imageupdates.APIHandler, apiKeyHandler *apikey.Handler,
	versionHandler *version.Handler, registryAPIHandler *registry.APIHandler) *authz.Registrar {

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(auth.RequireAuth(jwtSvc, apiKeySvc, userProvider))

	stackRegistrar := authz.NewRegistrar(apiProtected, authzEngine, "/api/v1")

	if versionHandler != nil {
		versionHandler.RegisterAPIRoutes(apiProtected)
	}

	mobileAuthHandler.RegisterProtectedAPIRoutes(apiProtected, rbacMiddleware.RequireAPIKeyDenied())

	if serverUserAPIHandler != nil {
		serverUserAPIHandler.RegisterProtectedAPIRoutes(apiProtected, rbacMiddleware.RequireUserScopeJWT(rbac.PermServersRead))
	}
	if stackAPIHandler != nil {
		stackAPIHandler.RegisterProtectedAPIRoutes(stackRegistrar)
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

	return stackRegistrar
}

func registerAdminAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider,
	rbacMiddleware *rbac.Middleware, rbacAPIHandler *rbac.APIHandler, operationLogsHandler *operationlogs.Handler,
	serverAPIHandler *server.APIHandler, migrationHandler *dataexport.Handler, securityHandler *security.Handler) {

	if rbacAPIHandler == nil || rbacMiddleware == nil {
		return
	}

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(auth.RequireAuth(jwtSvc, apiKeySvc, userProvider))

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
