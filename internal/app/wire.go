package app

import (
	"context"
	"fmt"
	"io"
	"path/filepath"

	"berth/internal/domain/agent"
	"berth/internal/domain/apikey"
	"berth/internal/domain/auth"
	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/auth/totp"
	"berth/internal/domain/dashboard"
	"berth/internal/domain/dataexport"
	"berth/internal/domain/files"
	"berth/internal/domain/imageupdates"
	"berth/internal/domain/logs"
	"berth/internal/domain/maintenance"
	"berth/internal/domain/operationlogs"
	"berth/internal/domain/operations"
	"berth/internal/domain/queue"
	"berth/internal/domain/rbac"
	"berth/internal/domain/registry"
	"berth/internal/domain/security"
	"berth/internal/domain/server"
	"berth/internal/domain/session"
	"berth/internal/domain/setup"
	"berth/internal/domain/stack"
	"berth/internal/domain/version"
	"berth/internal/domain/vulnscan"
	"berth/internal/domain/websocket"
	"berth/internal/pkg/apidocs"
	"berth/internal/pkg/config"
	"berth/internal/pkg/crypto"
	"berth/internal/pkg/origin"
	"berth/internal/platform/inertia"
	"berth/internal/platform/mail"
	"berth/internal/platform/middleware/ratelimit"
	"berth/routes"
	"berth/seeds"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Hook struct {
	Name  string
	Start func(ctx context.Context) error
	Stop  func(ctx context.Context) error
}

type Overrides struct {
	Mail auth.MailService

	OperationAuditor OperationLogAuditor
	SecurityAuditor  SecurityLogAuditor

	BeforeRoutes func(*Graph)
}

type Graph struct {
	Cfg     *config.Config
	Logger  *zap.Logger
	DB      *gorm.DB
	Echo    *echo.Echo
	Inertia *inertia.Service
	SSL     *SSLConfig

	Mail        auth.MailService
	Crypto      *crypto.Crypto
	OriginCheck origin.CheckOriginFunc
	RateLimit   *ratelimit.Store
	APIDocs     *apidocs.OpenAPI

	JWTSvc          *tokens.Service
	SessionMgr      *session.Manager
	SessionSvc      *session.Service
	SessionHandler  *session.Handler
	AuthSvc         *auth.Service
	AuthUserProv    auth.UserProvider
	TOTPSvc         *totp.Service
	AuthHandler     *auth.Handler
	AuthTOTPHandler *auth.TOTPHandler
	AuthAPIHandler  *auth.APIHandler

	OperationsSummaryParser *operations.SummaryParser
	OperationsAuditLogger   *operations.AuditLogger
	OperationsAuditSvc      *operations.AuditService
	OperationsSvc           *operations.Service
	OperationsHandler       *operations.Handler
	OperationsWSHandler     *operations.WebSocketHandler

	SecurityAuditLogger *security.AuditLogger
	SecurityAuditSvc    *security.AuditService
	SecurityHandler     *security.Handler

	AgentSvc               *agent.Service
	RBACSvc                *rbac.Service
	RBACMid                *rbac.Middleware
	RBACHandler            *rbac.Handler
	RBACAPIHandler         *rbac.APIHandler
	APIKeySvc              *apikey.Service
	APIKeyHandler          *apikey.Handler
	SetupSvc               *setup.Service
	SetupHandler           *setup.Handler
	ServerSvc              *server.Service
	ServerHandler          *server.Handler
	ServerAPIHandler       *server.APIHandler
	ServerUserAPIHandler   *server.UserAPIHandler
	StackSvc               *stack.Service
	StackHandler           *stack.Handler
	StackAPIHandler        *stack.APIHandler
	DashboardHandler       *dashboard.Handler
	MaintSvc               *maintenance.Service
	MaintHandler           *maintenance.Handler
	MaintAPIHandler        *maintenance.APIHandler
	FilesSvc               *files.Service
	FilesAPIHandler        *files.APIHandler
	LogsSvc                *logs.Service
	LogsHandler            *logs.Handler
	RegistrySvc            *registry.Service
	RegistryHandler        *registry.Handler
	RegistryAPIHandler     *registry.APIHandler
	OperationLogsSvc       *operationlogs.Service
	OperationLogsHandler   *operationlogs.Handler
	DataExportSvc          *dataexport.Service
	DataExportHandler      *dataexport.Handler
	QueueSvc               *queue.Service
	ImageUpdatesSvc        *imageupdates.Service
	ImageUpdatesAPIHandler *imageupdates.APIHandler
	VersionHandler         *version.Handler
	VulnscanSvc            *vulnscan.Service
	VulnscanHandler        *vulnscan.Handler
	VulnscanPoller         *vulnscan.Poller
	WSPermChecker          websocket.PermissionChecker
	WSHub                  *websocket.Hub
	WSAgentMgr             *websocket.AgentManager
	WSServiceMgr           *websocket.ServiceManager
	WSHandler              *websocket.Handler

	Hooks []Hook
}

func Build(
	cfg *config.Config,
	logger *zap.Logger,
	db *gorm.DB,
	e *echo.Echo,
	inertiaSvc *inertia.Service,
	ssl *SSLConfig,
	overrides Overrides,
) (*Graph, error) {
	g := &Graph{
		Cfg:     cfg,
		Logger:  logger,
		DB:      db,
		Echo:    e,
		Inertia: inertiaSvc,
		SSL:     ssl,
	}

	g.Crypto = crypto.NewCrypto(cfg.Custom.EncryptionSecret)
	g.OriginCheck = origin.NewOriginChecker(cfg.App.URL)
	g.RateLimit = ratelimit.NewStore()
	g.APIDocs = apidocs.NewOpenAPI()
	g.VersionHandler = version.NewHandler()

	if overrides.Mail != nil {
		g.Mail = overrides.Mail
	} else {
		client, err := mail.NewClient(cfg, logger)
		if err != nil {
			return nil, fmt.Errorf("mail client: %w", err)
		}
		g.Mail = client
	}

	jwtSvc, err := tokens.NewService(cfg, db, logger)
	if err != nil {
		return nil, fmt.Errorf("tokens service: %w", err)
	}
	g.JWTSvc = jwtSvc
	g.addHook("tokens cleanup worker", jwtSvc.Start, jwtSvc.Stop)

	sessionMgr, err := session.ProvideSessionManager(cfg, db, logger)
	if err != nil {
		return nil, fmt.Errorf("session manager: %w", err)
	}
	g.SessionMgr = sessionMgr
	g.SessionSvc = session.ProvideSessionService(db, sessionMgr, jwtSvc, logger)
	g.SessionHandler = session.NewHandler(db, inertiaSvc, g.SessionSvc)

	var sessionInvalidator auth.SessionInvalidator
	if g.SessionSvc != nil {
		sessionInvalidator = g.SessionSvc
	}
	g.AuthSvc = auth.NewService(cfg, db, g.Mail, sessionInvalidator, logger)
	g.AuthUserProv = auth.NewUserProvider(db)
	g.TOTPSvc = totp.NewService(cfg, db, logger)

	g.SecurityAuditLogger, err = security.NewAuditLogger(
		cfg.Custom.SecurityAuditLogLogToFile,
		filepath.Join(cfg.Custom.LogDir, "security"),
		logger,
		int64(cfg.Custom.LogFileSizeLimitMB)*1024*1024,
	)
	if err != nil {
		return nil, fmt.Errorf("security audit logger: %w", err)
	}
	g.addHook("security audit logger", nil, closeHook("security audit logger", logger, g.SecurityAuditLogger))
	g.SecurityAuditSvc = security.NewAuditService(db, logger)
	g.SecurityHandler = security.NewHandler(db)

	g.AuthHandler = auth.NewHandler(db, inertiaSvc, g.AuthSvc, g.TOTPSvc, logger, g.SecurityAuditSvc)
	g.AuthTOTPHandler = auth.NewTOTPHandler(db, inertiaSvc, g.TOTPSvc, g.AuthSvc, logger, g.SecurityAuditSvc)
	g.AuthAPIHandler = auth.NewAPIHandler(db, g.AuthSvc, jwtSvc, g.TOTPSvc, g.SessionSvc, logger, g.SecurityAuditSvc)

	g.AgentSvc = agent.NewService(logger, cfg.Custom.OperationTimeoutSeconds)

	g.RBACSvc = rbac.NewService(db, logger)
	g.RBACMid = rbac.NewMiddleware(g.RBACSvc)
	g.RBACHandler = rbac.NewRBACHandler(db, inertiaSvc, g.RBACSvc, g.AuthSvc, g.TOTPSvc, g.SecurityAuditSvc)
	g.RBACAPIHandler = rbac.NewAPIHandler(db, g.RBACSvc, g.TOTPSvc, g.AuthSvc, g.SecurityAuditSvc)

	g.APIKeySvc = apikey.NewService(db, logger, g.RBACSvc)
	g.APIKeyHandler = apikey.NewHandler(g.APIKeySvc, inertiaSvc, g.SecurityAuditSvc, db)

	g.SetupSvc = setup.NewService(db, g.RBACSvc, logger)
	g.SetupHandler = setup.NewHandler(g.SetupSvc, g.AuthSvc, inertiaSvc, logger)

	g.ServerSvc = server.NewService(db, g.Crypto, g.RBACSvc, g.AgentSvc, logger)
	g.ServerHandler = server.NewHandler(db, g.ServerSvc, inertiaSvc, g.SecurityAuditSvc)
	g.ServerAPIHandler = server.NewAPIHandler(g.ServerSvc)
	g.ServerUserAPIHandler = server.NewUserAPIHandler(g.ServerSvc, db)

	g.StackSvc = stack.NewService(g.AgentSvc, g.ServerSvc, g.RBACSvc, logger)
	g.StackHandler = stack.NewHandler(inertiaSvc, g.StackSvc, g.RBACSvc, g.ServerSvc)
	g.StackAPIHandler = stack.NewAPIHandler(g.StackSvc, logger, g.SecurityAuditSvc, db)

	g.DashboardHandler = dashboard.NewHandler(inertiaSvc, db, logger, g.ServerSvc)

	g.MaintSvc = maintenance.NewService(g.AgentSvc, g.ServerSvc, g.RBACSvc, logger)
	g.MaintHandler = maintenance.NewHandler(inertiaSvc, g.MaintSvc)
	g.MaintAPIHandler = maintenance.NewAPIHandler(g.MaintSvc, g.SecurityAuditSvc, db)

	g.FilesSvc = files.NewService(g.AgentSvc, g.ServerSvc, g.RBACSvc, logger)
	g.FilesAPIHandler = files.NewAPIHandler(db, g.FilesSvc, g.SecurityAuditSvc)

	g.LogsSvc = logs.NewService(g.AgentSvc, g.ServerSvc, g.RBACSvc, logger)
	g.LogsHandler = logs.NewHandler(g.LogsSvc)

	g.OperationsSummaryParser = operations.NewSummaryParser(logger)
	g.OperationsAuditLogger, err = operations.NewAuditLogger(
		cfg.Custom.OperationLogLogToFile,
		filepath.Join(cfg.Custom.LogDir, "operations"),
		logger,
		int64(cfg.Custom.LogFileSizeLimitMB)*1024*1024,
	)
	if err != nil {
		return nil, fmt.Errorf("operations audit logger: %w", err)
	}
	g.addHook("operation log audit logger", nil, closeHook("operation log audit logger", logger, g.OperationsAuditLogger))
	g.OperationsAuditSvc = operations.NewAuditService(db, logger, g.OperationsSummaryParser)

	g.RegistrySvc = registry.NewService(db, g.Crypto, logger)
	g.RegistryHandler = registry.NewHandler(g.RegistrySvc, g.RBACSvc, g.ServerSvc, inertiaSvc)
	g.RegistryAPIHandler = registry.NewAPIHandler(g.RegistrySvc, g.RBACSvc, db)

	g.OperationsSvc = operations.NewService(g.ServerSvc, g.RBACSvc, g.OperationsAuditSvc, g.RegistrySvc, g.FilesSvc, logger)
	g.OperationsWSHandler = operations.NewWebSocketHandler(g.OperationsSvc, g.OriginCheck, logger)
	g.OperationsHandler = operations.NewHandler(g.OperationsSvc)

	g.OperationLogsSvc = operationlogs.NewService(db, logger)
	g.OperationLogsHandler = operationlogs.NewHandler(db, g.OperationLogsSvc, inertiaSvc, logger, cfg.Custom.OperationTimeoutSeconds)

	g.DataExportSvc = dataexport.NewService(db, logger)
	g.DataExportHandler = dataexport.NewHandler(inertiaSvc, logger, g.DataExportSvc, g.RBACSvc)

	g.QueueSvc = queue.NewService(db, g.OperationsSvc, g.RBACSvc, logger, g.SecurityAuditSvc, cfg.Custom.OperationTimeoutSeconds)

	g.ImageUpdatesSvc = imageupdates.NewService(db, g.AgentSvc, g.ServerSvc, g.Crypto, logger, cfg)
	g.ImageUpdatesAPIHandler = imageupdates.NewAPIHandler(g.ImageUpdatesSvc, g.RBACSvc, logger)

	g.VulnscanSvc = vulnscan.NewService(db, g.ServerSvc, g.AgentSvc, g.RBACSvc, logger)
	g.VulnscanHandler = vulnscan.NewHandler(g.VulnscanSvc, logger)
	g.VulnscanPoller = vulnscan.NewPoller(db, g.VulnscanSvc, logger)
	g.addHook("vulnscan poller",
		func(context.Context) error { g.VulnscanPoller.Start(); return nil },
		func(context.Context) error { g.VulnscanPoller.Stop(); return nil },
	)

	g.WSPermChecker = websocket.NewRBACPermissionChecker(g.RBACSvc)
	g.WSHub = websocket.NewHub(g.WSPermChecker, logger, g.OriginCheck)
	g.WSAgentMgr = websocket.NewAgentManager(g.WSHub, logger)
	g.WSServiceMgr = websocket.NewServiceManager(g.ServerSvc, g.WSAgentMgr, logger)
	g.WSHandler = websocket.NewHandler(g.WSHub, g.JWTSvc, g.WSPermChecker, g.ServerSvc, g.OperationsAuditSvc, g.OriginCheck)
	g.addHook("websocket hub",
		func(context.Context) error { go g.WSHub.Run(); return nil },
		nil,
	)
	g.addHook("websocket service manager",
		func(context.Context) error {
			go func() {
				if serr := g.WSServiceMgr.Start(); serr != nil {
					logger.Error("websocket service manager startup failed", zap.Error(serr))
				}
			}()
			return nil
		},
		nil,
	)

	routes.RegisterAPIDocs(g.APIDocs)
	routes.RegisterOpenAPIEndpoints(e, g.APIDocs, cfg)

	registerAuditCallbacks(db, g, overrides)

	installCoreMiddleware(g)
	g.addHook("inertia init", inertiaInitHook(cfg, inertiaSvc), nil)

	if err := wireTestSupport(g); err != nil {
		return nil, fmt.Errorf("test support wiring: %w", err)
	}

	if overrides.BeforeRoutes != nil {
		overrides.BeforeRoutes(g)
	}

	routes.RegisterRoutes(buildRouteParams(g))

	if err := seeds.SeedRBACData(db); err != nil {
		return nil, fmt.Errorf("seed rbac: %w", err)
	}

	httpSvr := newHTTPServer(e, cfg, ssl, logger)
	g.addHook("http server", httpSvr.start, httpSvr.stop)

	return g, nil
}

func (g *Graph) addHook(name string, start, stop func(context.Context) error) {
	g.Hooks = append(g.Hooks, Hook{Name: name, Start: start, Stop: stop})
}

func closeHook(name string, logger *zap.Logger, c io.Closer) func(context.Context) error {
	return func(context.Context) error {
		logger.Info("closing " + name)
		if err := c.Close(); err != nil {
			logger.Error("failed to close "+name, zap.Error(err))
			return err
		}
		logger.Info(name + " closed successfully")
		return nil
	}
}

func installCoreMiddleware(g *Graph) {
	if g.SessionMgr != nil {
		g.Echo.Use(session.Middleware(g.SessionMgr))
	}
	g.Echo.Use(g.Inertia.Middleware())
	g.Echo.Use(inertia.SharedContext(
		g.AuthUserProv.GetUser,
		session.IsAuthenticated,
		session.GetUserIDAsUint,
		InertiaFlashMessages,
	))
}

func inertiaInitHook(cfg *config.Config, svc *inertia.Service) func(context.Context) error {
	return func(context.Context) error {
		rootView := cfg.Inertia.RootView
		if rootView == "" {
			rootView = "app.html"
		}
		if err := svc.InitializeFromFile(rootView); err != nil {
			return err
		}
		if !cfg.Inertia.Development {
			_ = svc.LoadManifest("public/build/.vite/manifest.json")
		}
		svc.ShareAssetData()
		return nil
	}
}

func registerAuditCallbacks(db *gorm.DB, g *Graph, overrides Overrides) {
	var op OperationLogAuditor = g.OperationsAuditLogger
	if overrides.OperationAuditor != nil {
		op = overrides.OperationAuditor
	}
	var sec SecurityLogAuditor = g.SecurityAuditLogger
	if overrides.SecurityAuditor != nil {
		sec = overrides.SecurityAuditor
	}
	RegisterAuditCallbacks(AuditCallbackParams{
		DB:                   db,
		OperationAuditLogger: op,
		SecurityAuditLogger:  sec,
	})
}

func buildRouteParams(g *Graph) routes.RouteParams {
	return routes.RouteParams{
		Srv:                    g.Echo,
		DashboardHandler:       g.DashboardHandler,
		AuthHandler:            g.AuthHandler,
		MobileAuthHandler:      g.AuthAPIHandler,
		SessionHandler:         g.SessionHandler,
		TOTPHandler:            g.AuthTOTPHandler,
		VersionHandler:         g.VersionHandler,
		MigrationHandler:       g.DataExportHandler,
		OperationLogsHandler:   g.OperationLogsHandler,
		RBACHandler:            g.RBACHandler,
		RBACAPIHandler:         g.RBACAPIHandler,
		RBACMiddleware:         g.RBACMid,
		SetupHandler:           g.SetupHandler,
		ServerHandler:          g.ServerHandler,
		ServerAPIHandler:       g.ServerAPIHandler,
		ServerUserAPIHandler:   g.ServerUserAPIHandler,
		StackHandler:           g.StackHandler,
		StackAPIHandler:        g.StackAPIHandler,
		MaintenanceHandler:     g.MaintHandler,
		MaintenanceAPIHandler:  g.MaintAPIHandler,
		FilesAPIHandler:        g.FilesAPIHandler,
		LogsHandler:            g.LogsHandler,
		OperationsHandler:      g.OperationsHandler,
		OperationsWSHandler:    g.OperationsWSHandler,
		RegistryHandler:        g.RegistryHandler,
		RegistryAPIHandler:     g.RegistryAPIHandler,
		WSHandler:              g.WSHandler,
		SecurityHandler:        g.SecurityHandler,
		APIKeyHandler:          g.APIKeyHandler,
		APIKeySvc:              g.APIKeySvc,
		ImageUpdatesAPIHandler: g.ImageUpdatesAPIHandler,
		VulnscanHandler:        g.VulnscanHandler,
		SessionManager:         g.SessionMgr,
		SessionService:         g.SessionSvc,
		RateLimitStore:         g.RateLimit,
		InertiaService:         g.Inertia,
		JWTSvc:                 g.JWTSvc,
		UserProvider:           g.AuthUserProv,
		AuthSvc:                g.AuthSvc,
		TOTPSvc:                g.TOTPSvc,
		Logger:                 g.Logger,
		Cfg:                    g.Cfg,
	}
}
