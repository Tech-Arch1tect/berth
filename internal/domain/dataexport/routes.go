package dataexport

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *Handler) RegisterAdminAPIRoutes(reg *authz.Registrar) {
	reg.POST("/migration/export", h.Export, authz.Admin(permnames.AdminSystemExport))
	reg.POST("/migration/import", h.Import, authz.Admin(permnames.AdminSystemImport))
}
