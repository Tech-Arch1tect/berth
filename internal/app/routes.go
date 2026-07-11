package app

import (
	"net/http"
	"path/filepath"
	"time"

	"berth/internal/domain/apikey"
	"berth/internal/domain/auth"
	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/authz"
	authzengine "berth/internal/domain/authz/engine"
	"berth/internal/domain/backups"
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
)

func newRateLimit(cfg *config.Config, rlc ratelimit.Config) echo.MiddlewareFunc {
	if !cfg.RateLimit.Enabled {
		return func(next echo.HandlerFunc) echo.HandlerFunc { return next }
	}
	return ratelimit.New(rlc)
}

func registerRoutes(g *Graph) {
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

	registerStaticAssetRoutes(e, "public")

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

	authzEngine := g.AuthzEngine

	publicRegistrar := registerAPIAuthRoutes(api, authApiRateLimit, g.AuthAPIHandler, authzEngine)
	protectedRegistrar := registerProtectedAPIRoutes(api, generalApiRateLimit, g.JWTSvc, g.APIKeySvc, g.AuthUserProv, g.SecurityAuditSvc,
		g.AuthAPIHandler, g.ServerUserAPIHandler, authzEngine,
		g.StackAPIHandler, g.FilesAPIHandler, g.BackupsAPIHandler, g.LogsHandler, g.OperationsHandler,
		g.OperationLogsHandler, g.MaintAPIHandler, g.VulnscanHandler,
		g.ImageUpdatesAPIHandler, g.APIKeyHandler, g.VersionHandler, g.RegistryAPIHandler)
	adminRegistrar := registerAdminAPIRoutes(api, generalApiRateLimit, g.JWTSvc, g.APIKeySvc, g.AuthUserProv, g.SecurityAuditSvc,
		g.RBACAPIHandler, g.OperationLogsHandler,
		g.ServerAPIHandler, g.DataExportHandler, g.SecurityHandler, authzEngine)
	wsRegistrar := registerAPIWebSocketRoutes(e, g.JWTSvc, g.APIKeySvc, g.AuthUserProv, g.SecurityAuditSvc, g.WSHandler, g.WSEventsHandler, g.OperationsStreamHandler, authzEngine)

	auditRegistrars := []*authz.Registrar{publicRegistrar, protectedRegistrar, adminRegistrar}
	if wsRegistrar != nil {
		auditRegistrars = append(auditRegistrars, wsRegistrar)
	}
	authz.MustAuditRoutes(e, auditRegistrars...)

	if g.SPASvc != nil {
		e.GET("/*", g.SPASvc.Render)
	}
}

func registerStaticAssetRoutes(e *echo.Echo, publicDir string) {
	buildDir := filepath.Join(publicDir, "build")
	pwaDir := filepath.Join(publicDir, "pwa")

	e.GET("/build/sw.js", func(c echo.Context) error {
		c.Response().Header().Set("Service-Worker-Allowed", "/")
		c.Response().Header().Set("Cache-Control", "no-cache")
		c.Response().Header().Set(echo.HeaderContentType, "text/javascript; charset=utf-8")
		return c.File(filepath.Join(buildDir, "sw.js"))
	})
	e.GET("/build/*", echo.WrapHandler(http.StripPrefix("/build/", http.FileServer(http.Dir(buildDir)))))

	e.GET("/pwa/manifest.webmanifest", func(c echo.Context) error {
		c.Response().Header().Set(echo.HeaderContentType, "application/manifest+json")
		return c.File(filepath.Join(pwaDir, "manifest.webmanifest"))
	})
	e.GET("/pwa/*", echo.WrapHandler(http.StripPrefix("/pwa/", http.FileServer(http.Dir(pwaDir)))))
}

func registerAPIAuthRoutes(api *echo.Group, authApiRateLimit echo.MiddlewareFunc, mobileAuthHandler *auth.APIHandler, authzEngine *authzengine.Engine) *authz.Registrar {
	authApi := api.Group("/auth")
	authApi.Use(authApiRateLimit)
	publicRegistrar := authz.NewRegistrar(authApi, "/api/v1/auth", authzEngine.Middleware)
	mobileAuthHandler.RegisterPublicAPIRoutes(publicRegistrar)
	return publicRegistrar
}

func registerProtectedAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider, auditor auth.APIKeyAuthAuditor,
	mobileAuthHandler *auth.APIHandler, serverUserAPIHandler *server.UserAPIHandler,
	authzEngine *authzengine.Engine, stackAPIHandler *stack.APIHandler, filesAPIHandler *files.APIHandler, backupsAPIHandler *backups.APIHandler, logsHandler *logs.Handler,
	operationsHandler *operations.Handler, operationLogsHandler *operationlogs.Handler, maintenanceAPIHandler *maintenance.APIHandler,
	vulnscanHandler *vulnscan.Handler, imageUpdatesAPIHandler *imageupdates.APIHandler, apiKeyHandler *apikey.Handler,
	versionHandler *version.Handler, registryAPIHandler *registry.APIHandler) *authz.Registrar {

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(auth.RequireAuth(jwtSvc, apiKeySvc, userProvider, auditor))

	protectedRegistrar := authz.NewRegistrar(apiProtected, "/api/v1", authzEngine.Middleware)

	if versionHandler != nil {
		versionHandler.RegisterAPIRoutes(protectedRegistrar)
	}

	mobileAuthHandler.RegisterProtectedAPIRoutes(protectedRegistrar)

	if serverUserAPIHandler != nil {
		serverUserAPIHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if stackAPIHandler != nil {
		stackAPIHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if vulnscanHandler != nil {
		vulnscanHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if filesAPIHandler != nil {
		filesAPIHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if backupsAPIHandler != nil {
		backupsAPIHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if logsHandler != nil {
		logsHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if operationsHandler != nil {
		operationsHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if operationLogsHandler != nil {
		operationLogsHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if maintenanceAPIHandler != nil {
		maintenanceAPIHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if imageUpdatesAPIHandler != nil {
		imageUpdatesAPIHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if apiKeyHandler != nil {
		apiKeyHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}
	if registryAPIHandler != nil {
		registryAPIHandler.RegisterProtectedAPIRoutes(protectedRegistrar)
	}

	return protectedRegistrar
}

func registerAdminAPIRoutes(api *echo.Group, generalApiRateLimit echo.MiddlewareFunc, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider, auditor auth.APIKeyAuthAuditor,
	rbacAPIHandler *rbac.APIHandler, operationLogsHandler *operationlogs.Handler,
	serverAPIHandler *server.APIHandler, migrationHandler *dataexport.Handler, securityHandler *security.Handler,
	authzEngine *authzengine.Engine) *authz.Registrar {

	if rbacAPIHandler == nil {
		return nil
	}

	apiProtected := api.Group("")
	apiProtected.Use(generalApiRateLimit)
	apiProtected.Use(auth.RequireAuth(jwtSvc, apiKeySvc, userProvider, auditor))

	apiAdmin := apiProtected.Group("/admin")
	adminRegistrar := authz.NewRegistrar(apiAdmin, "/api/v1/admin", authzEngine.Middleware)

	rbacAPIHandler.RegisterAdminAPIRoutes(adminRegistrar)
	if operationLogsHandler != nil {
		operationLogsHandler.RegisterAdminAPIRoutes(adminRegistrar)
	}
	if serverAPIHandler != nil {
		serverAPIHandler.RegisterAdminAPIRoutes(adminRegistrar)
	}
	if migrationHandler != nil {
		migrationHandler.RegisterAdminAPIRoutes(adminRegistrar)
	}
	if securityHandler != nil {
		securityHandler.RegisterAdminAPIRoutes(adminRegistrar)
	}

	return adminRegistrar
}

func registerAPIWebSocketRoutes(srv *echo.Echo, jwtSvc *tokens.Service, apiKeySvc *apikey.Service, userProvider auth.UserProvider, auditor auth.APIKeyAuthAuditor, wsHandler *websocket.Handler, eventsHandler *websocket.EventsHandler, operationsStreamHandler *operations.StreamHandler, authzEngine *authzengine.Engine) *authz.Registrar {
	if wsHandler == nil {
		return nil
	}

	wsGroup := srv.Group("/ws")
	wsAPIGroup := wsGroup.Group("/api")
	wsAPIGroup.Use(auth.RequireAuth(jwtSvc, apiKeySvc, userProvider, auditor))

	wsRegistrar := authz.NewRegistrar(wsAPIGroup, "/ws/api", authzEngine.Middleware)
	wsHandler.RegisterProtectedAPIRoutes(wsRegistrar)
	if eventsHandler != nil {
		eventsHandler.RegisterRoutes(wsRegistrar)
	}
	if operationsStreamHandler != nil {
		operationsStreamHandler.RegisterRoutes(wsRegistrar)
	}

	return wsRegistrar
}
