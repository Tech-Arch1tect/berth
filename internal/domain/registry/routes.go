package registry

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/registries", h.ListCredentials, authz.Server(permnames.RegistriesManage))
	reg.GET("/servers/:serverid/registries/:id", h.GetCredential, authz.Server(permnames.RegistriesManage))
	reg.POST("/servers/:serverid/registries", h.CreateCredential, authz.Server(permnames.RegistriesManage))
	reg.PUT("/servers/:serverid/registries/:id", h.UpdateCredential, authz.Server(permnames.RegistriesManage))
	reg.DELETE("/servers/:serverid/registries/:id", h.DeleteCredential, authz.Server(permnames.RegistriesManage))
}
