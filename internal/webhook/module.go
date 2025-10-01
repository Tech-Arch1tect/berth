package webhook

import (
	"berth/internal/queue"
	"berth/internal/rbac"
	"berth/internal/security"
	"berth/internal/server"
	"berth/internal/stack"

	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func Module() fx.Option {
	return fx.Module("webhook",
		fx.Provide(
			NewServiceWithDeps,
			NewHandlerWithDeps,
			NewUIHandlerWithDeps,
		),
	)
}

type ServiceDeps struct {
	fx.In
	DB     *gorm.DB
	RBAC   *rbac.Service
	Logger *logging.Service
}

type HandlerDeps struct {
	fx.In
	DB             *gorm.DB
	WebhookService *Service
	QueueService   *queue.Service
	ServerService  *server.Service
	RBACService    *rbac.Service
	StackService   *stack.Service
	InertiaService *inertia.Service
	AuditService   *security.AuditService
}

type UIHandlerDeps struct {
	fx.In
	WebhookService *Service
	ServerService  *server.Service
	InertiaService *inertia.Service
}

func NewServiceWithDeps(deps ServiceDeps) *Service {
	return NewService(deps.DB, deps.RBAC, deps.Logger)
}

func NewHandlerWithDeps(deps HandlerDeps) *Handler {
	return NewHandler(deps.DB, deps.WebhookService, deps.QueueService, deps.ServerService, deps.RBACService, deps.StackService, deps.InertiaService, deps.AuditService)
}

func NewUIHandlerWithDeps(deps UIHandlerDeps) *UIHandler {
	return NewUIHandler(deps.WebhookService, deps.ServerService, deps.InertiaService)
}
