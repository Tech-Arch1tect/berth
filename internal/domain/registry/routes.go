package registry

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac"
)

func (h *APIHandler) RegisterProtectedAPIRoutes(reg *authz.Registrar) {
	reg.GET("/servers/:serverid/registries", h.ListCredentials, authz.Server(rbac.PermRegistriesManage))
	reg.GET("/servers/:serverid/registries/:id", h.GetCredential, authz.Server(rbac.PermRegistriesManage))
	reg.POST("/servers/:serverid/registries", h.CreateCredential, authz.Server(rbac.PermRegistriesManage))
	reg.PUT("/servers/:serverid/registries/:id", h.UpdateCredential, authz.Server(rbac.PermRegistriesManage))
	reg.DELETE("/servers/:serverid/registries/:id", h.DeleteCredential, authz.Server(rbac.PermRegistriesManage))
}
