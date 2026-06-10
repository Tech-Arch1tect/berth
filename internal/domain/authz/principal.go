package authz

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

const PrincipalContextKey = "_authz_principal"

type KeyScope struct {
	ServerID     *uint
	StackPattern string
	Permission   string
}

type KeyDescriptor struct {
	ID     uint
	Scopes []KeyScope
}

type Principal struct {
	userID  uint
	isAdmin bool
	key     *KeyDescriptor
	system  bool
}

func NewPrincipal(userID uint, isAdmin bool, key *KeyDescriptor) Principal {
	return Principal{userID: userID, isAdmin: isAdmin, key: key}
}

var SystemPrincipal = Principal{system: true}

func (p Principal) UserID() uint        { return p.userID }
func (p Principal) IsAdmin() bool       { return p.isAdmin }
func (p Principal) Key() *KeyDescriptor { return p.key }
func (p Principal) IsSystem() bool      { return p.system }

func (p Principal) IsAuthenticated() bool { return p.system || p.userID != 0 }

func SetPrincipal(c echo.Context, p Principal) {
	c.Set(PrincipalContextKey, p)
}

func PrincipalFromEcho(c echo.Context) (Principal, bool) {
	v := c.Get(PrincipalContextKey)
	if v == nil {
		return Principal{}, false
	}
	p, ok := v.(Principal)
	if !ok || !p.IsAuthenticated() {
		return Principal{}, false
	}
	return p, true
}

func RequirePrincipal(c echo.Context) (Principal, error) {
	p, ok := PrincipalFromEcho(c)
	if !ok {
		return Principal{}, echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
	}
	return p, nil
}
