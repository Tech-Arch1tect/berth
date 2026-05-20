package version

import "berth/internal/domain/authz"

func (h *Handler) RegisterAPIRoutes(reg *authz.Registrar) {
	reg.GET("/version", h.GetVersion, authz.Authenticated())
}
