package logs

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac"
)

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/logs", h.GetStackLogs, authz.Stack(rbac.PermLogsRead))
	reg.GET("/servers/:serverid/stacks/:stackname/containers/:containerName/logs", h.GetContainerLogs, authz.Stack(rbac.PermLogsRead))
}
