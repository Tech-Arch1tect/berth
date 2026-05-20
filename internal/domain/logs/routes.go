package logs

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/logs", h.GetStackLogs, authz.Stack(permnames.LogsRead))
	reg.GET("/servers/:serverid/stacks/:stackname/containers/:containerName/logs", h.GetContainerLogs, authz.Stack(permnames.LogsRead))
}
