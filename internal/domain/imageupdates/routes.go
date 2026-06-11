package imageupdates

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/image-updates", h.ListAvailableUpdates, authz.Authenticated().WithListScope().RequireAPIKeyScope(permnames.ImageUpdatesRead))
	reg.GET("/servers/:serverid/image-updates", h.ListServerUpdates, authz.Server(permnames.StacksRead).WithListScope())
}
