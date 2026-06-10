package operations

import (
	"berth/internal/domain/authz"
)

func (h *Handler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.POST("/servers/:serverid/stacks/:stackname/operations", h.StartOperation, authz.Resolved(operationRequirement))
}

func (h *StreamHandler) RegisterRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/stacks/:stackname/operations/:operationId", h.HandleOperationStream, authz.Resolved(h.streamRequirement))
}
