package authz

import (
	"berth/internal/domain/apikey"
	usermodel "berth/internal/domain/user"
)

type Principal struct {
	UserID uint
	Roles  []usermodel.Role
	APIKey *apikey.APIKey
	system bool
}

func (p Principal) IsSystem() bool { return p.system }

var SystemPrincipal = Principal{system: true}
