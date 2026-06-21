package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"

	"berth/internal/domain/agent"
	"berth/internal/domain/apikey"
	"berth/internal/domain/auth"
	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/auth/totp"
	authzengine "berth/internal/domain/authz/engine"
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
	"berth/internal/platform/mail"
	"berth/internal/platform/middleware/ratelimit"
	"berth/internal/platform/retention"
	"berth/internal/platform/spa"
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
	Cfg    *config.Config
	Logger *zap.Logger
	DB     *gorm.DB
	Echo   *echo.Echo
	SSL    *SSLConfig

	Mail        auth.MailService
	Crypto      *crypto.Crypto
	OriginCheck origin.CheckOriginFunc
	RateLimit   *ratelimit.Store
	APIDocs     *apidocs.OpenAPI

	JWTSvc         *tokens.Service
	SessionSvc     *session.Service
	AuthSvc        *auth.Service
	AuthUserProv   auth.UserProvider
	TOTPSvc        *totp.Service
	AuthAPIHandler *auth.APIHandler

	OperationsSummaryParser *operations.SummaryParser
	OperationsAuditLogger   *operations.AuditLogger
	OperationsAuditSvc      *operations.AuditService
	OperationsSvc           *operations.Service
	OperationsHandler       *operations.Handler
	OperationsStreamHandler *operations.StreamHandler

	SecurityAuditLogger *security.AuditLogger
	SecurityAuditSvc    *security.AuditService
	SecurityHandler     *security.Handler

	AgentSvc               *agent.Service
	RBACSvc                *rbac.Service
	AuthzEngine            *authzengine.Engine
	RBACAPIHandler         *rbac.APIHandler
	APIKeySvc              *apikey.Service
	APIKeyHandler          *apikey.Handler
	SetupSvc               *setup.Service
	ServerSvc              *server.Service
	ServerAPIHandler       *server.APIHandler
	ServerUserAPIHandler   *server.UserAPIHandler
	StackSvc               *stack.Service
	StackAPIHandler        *stack.APIHandler
	MaintSvc               *maintenance.Service
	MaintAPIHandler        *maintenance.APIHandler
	FilesSvc               *files.Service
	FilesAPIHandler        *files.APIHandler
	LogsSvc                *logs.Service
	LogsHandler            *logs.Handler
	RegistrySvc            *registry.Service
	RegistryAPIHandler     *registry.APIHandler
	OperationLogsSvc       *operationlogs.Service
	OperationLogsHandler   *operationlogs.Handler
	DataExportSvc          *dataexport.Service
	DataExportHandler      *dataexport.Handler
	ImageUpdatesSvc        *imageupdates.Service
	ImageUpdatesAPIHandler *imageupdates.APIHandler
	VersionHandler         *version.Handler
	VulnscanSvc            *vulnscan.Service
	VulnscanHandler        *vulnscan.Handler
	VulnscanPoller         *vulnscan.Poller
	WSEventRegistry        *websocket.StackEventRegistry
	WSEventsHandler        *websocket.EventsHandler
	WSAgentMgr             *websocket.AgentManager
	WSServiceMgr           *websocket.ServiceManager
	WSHandler              *websocket.Handler

	RetentionWorker *retention.Worker

	SPASvc *spa.Service

	Hooks []Hook
}

func Build(
	cfg *config.Config,
	logger *zap.Logger,
	db *gorm.DB,
	e *echo.Echo,
	ssl *SSLConfig,
	overrides Overrides,
) (*Graph, error) {
	g := &Graph{
		Cfg:    cfg,
		Logger: logger,
		DB:     db,
		Echo:   e,
		SSL:    ssl,
	}

	g.Crypto = crypto.NewCrypto(cfg.Custom.EncryptionSecret)
	g.OriginCheck = origin.NewOriginChecker(cfg.App.URL)
	g.RateLimit = ratelimit.NewStore()
	g.addHook("rate limit store cleanup", nil, func(context.Context) error {
		g.RateLimit.Stop()
		return nil
	})
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

	g.SessionSvc = session.ProvideSessionService(db, jwtSvc, logger)

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

	g.AuthAPIHandler = auth.NewAPIHandler(db, g.AuthSvc, jwtSvc, g.TOTPSvc, g.SessionSvc, logger, g.SecurityAuditSvc)

	g.AgentSvc = agent.NewService(logger, cfg.Custom.OperationTimeoutSeconds)

	g.RBACSvc = rbac.NewService(db, logger)
	g.RBACAPIHandler = rbac.NewAPIHandler(db, g.RBACSvc, g.TOTPSvc, g.AuthSvc, g.SecurityAuditSvc)

	g.AuthzEngine = authzengine.New(db, logger)

	g.APIKeySvc = apikey.NewService(db, logger, g.AuthzEngine)
	g.APIKeyHandler = apikey.NewHandler(g.APIKeySvc, g.SecurityAuditSvc)

	g.SetupSvc = setup.NewService(db, g.RBACSvc, logger)

	g.ServerSvc = server.NewService(db, g.Crypto, g.AuthzEngine, g.RBACSvc, g.AgentSvc, logger)
	g.ServerAPIHandler = server.NewAPIHandler(g.ServerSvc)
	g.ServerUserAPIHandler = server.NewUserAPIHandler(g.ServerSvc)

	g.StackSvc = stack.NewService(g.AgentSvc, g.ServerSvc, g.AuthzEngine, logger)
	g.StackAPIHandler = stack.NewAPIHandler(g.StackSvc, logger, g.SecurityAuditSvc)

	g.MaintSvc = maintenance.NewService(g.AgentSvc, g.ServerSvc, g.AuthzEngine, logger)
	g.MaintAPIHandler = maintenance.NewAPIHandler(g.MaintSvc, g.SecurityAuditSvc)

	g.FilesSvc = files.NewService(g.AgentSvc, g.ServerSvc, g.AuthzEngine, logger)
	g.FilesAPIHandler = files.NewAPIHandler(g.FilesSvc, g.SecurityAuditSvc)

	g.LogsSvc = logs.NewService(g.AgentSvc, g.ServerSvc, g.AuthzEngine, logger)
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
	g.RegistryAPIHandler = registry.NewAPIHandler(g.RegistrySvc, g.AuthzEngine, db)

	g.OperationsSvc = operations.NewService(g.ServerSvc, g.AuthzEngine, g.OperationsAuditSvc, g.RegistrySvc, g.FilesSvc, logger)
	g.OperationsStreamHandler = operations.NewStreamHandler(g.OperationsSvc, g.OriginCheck, logger)
	g.OperationsHandler = operations.NewHandler(g.OperationsSvc)

	g.OperationLogsSvc = operationlogs.NewService(db, logger)
	g.OperationLogsHandler = operationlogs.NewHandler(db, g.OperationLogsSvc, logger, cfg.Custom.OperationTimeoutSeconds)

	g.RetentionWorker = retention.NewWorker(cfg.Retention.Interval, logger, retentionTasks(cfg, g)...)
	g.addHook("retention worker", g.RetentionWorker.Start, g.RetentionWorker.Stop)

	g.DataExportSvc = dataexport.NewService(db, logger)
	g.DataExportHandler = dataexport.NewHandler(logger, g.DataExportSvc)

	g.ImageUpdatesSvc = imageupdates.NewService(db, g.AgentSvc, g.ServerSvc, g.Crypto, logger, cfg)
	g.ImageUpdatesAPIHandler = imageupdates.NewAPIHandler(g.ImageUpdatesSvc, logger)

	g.VulnscanSvc = vulnscan.NewService(db, g.ServerSvc, g.AgentSvc, g.AuthzEngine, logger)
	g.VulnscanHandler = vulnscan.NewHandler(g.VulnscanSvc, logger)
	g.VulnscanPoller = vulnscan.NewPoller(db, g.VulnscanSvc, logger)
	g.addHook("vulnscan poller",
		func(context.Context) error { g.VulnscanPoller.Start(); return nil },
		func(context.Context) error { g.VulnscanPoller.Stop(); return nil },
	)

	g.WSEventRegistry = websocket.NewStackEventRegistry(logger)
	g.WSEventsHandler = websocket.NewEventsHandler(g.WSEventRegistry, g.OriginCheck, logger)
	g.WSAgentMgr = websocket.NewAgentManager(g.WSEventRegistry, logger)
	g.WSServiceMgr = websocket.NewServiceManager(g.ServerSvc, g.WSAgentMgr, logger)
	g.WSHandler = websocket.NewHandler(g.ServerSvc, g.OperationsAuditSvc, g.OriginCheck)
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

	g.SPASvc = spa.New(cfg.Frontend.Development, cfg.Frontend.ViteDevURL, logger)
	if err := g.SPASvc.LoadTemplate(cfg.Frontend.RootView); err != nil {
		return nil, fmt.Errorf("SPA template: %w", err)
	}
	if err := g.SPASvc.LoadManifest(spa.ManifestPath); err != nil {
		logger.Warn("SPA manifest not loaded; assets will be missing in production renders", zap.Error(err))
	}

	routes.RegisterAPIDocs(g.APIDocs)
	routes.RegisterOpenAPIEndpoints(e, g.APIDocs, cfg)

	registerAuditCallbacks(db, g, overrides)

	if err := wireTestSupport(g); err != nil {
		return nil, fmt.Errorf("test support wiring: %w", err)
	}

	if overrides.BeforeRoutes != nil {
		overrides.BeforeRoutes(g)
	}

	registerRoutes(g)

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

func retentionTasks(cfg *config.Config, g *Graph) []retention.Task {
	var tasks []retention.Task

	if cfg.Retention.AuditLogDays > 0 {
		tasks = append(tasks, retention.Task{
			Name: "security audit logs",
			Run: func() error {
				_, err := g.SecurityAuditSvc.DeleteOldLogs(cfg.Retention.AuditLogDays)
				return err
			},
		})
	}

	if cfg.Retention.OperationLogDays > 0 {
		tasks = append(tasks, retention.Task{
			Name: "operation logs",
			Run: func() error {
				_, err := g.OperationLogsSvc.DeleteOldOperationLogs(cfg.Retention.OperationLogDays)
				return err
			},
		})
	}

	tasks = append(tasks, retention.Task{
		Name: "expired password reset tokens",
		Run: func() error {
			if err := g.AuthSvc.CleanupExpiredTokens(); err != nil && !errors.Is(err, auth.ErrPasswordResetDisabled) {
				return err
			}
			return nil
		},
	})

	return tasks
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
