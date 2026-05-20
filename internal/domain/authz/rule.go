package authz

import (
	"fmt"
	"net/http"

	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
)

type ruleKind int

const (
	rulePublic ruleKind = iota
	ruleAuthenticated
	ruleAPIKeyDenied
	ruleStack
	ruleServer
	ruleServerAccess
	ruleAdmin
	ruleResolved
)

type Rule struct {
	kind        ruleKind
	perm        string
	serverParam string
	stackParam  string
	apiKeyPerm  string
	public      bool
	denyAPIKey  bool
	listScope   bool
	customFn    func(echo.Context) ([]Requirement, error)
}

func newRule(k ruleKind) Rule {
	return Rule{kind: k, serverParam: "serverid", stackParam: "stackname"}
}

func (r Rule) Resolve(c echo.Context) ([]Requirement, error) {
	reqs, err := r.resolveBase(c)
	if err != nil {
		return nil, err
	}
	if r.apiKeyPerm != "" {
		reqs = append(reqs, Requirement{Kind: KindAPIKeyScope, Permission: r.apiKeyPerm})
	}
	return reqs, nil
}

func (r Rule) IsPublic() bool       { return r.public }
func (r Rule) DeniesAPIKey() bool   { return r.denyAPIKey }
func (r Rule) WantsListScope() bool { return r.listScope }

func (r Rule) resolveBase(c echo.Context) ([]Requirement, error) {
	switch r.kind {
	case rulePublic:
		return nil, nil
	case ruleAuthenticated, ruleAPIKeyDenied:
		return []Requirement{{Kind: KindAuthenticated}}, nil
	case ruleStack:
		id, stack, err := r.parseServerIDAndStack(c)
		if err != nil {
			return nil, err
		}
		return []Requirement{{Kind: KindStack, Permission: r.perm, ServerID: id, Stack: stack}}, nil
	case ruleServer:
		id, err := echoparams.ParseUintParam(c, r.serverParam)
		if err != nil {
			return nil, err
		}
		return []Requirement{{Kind: KindServer, Permission: r.perm, ServerID: id}}, nil
	case ruleServerAccess:
		id, err := echoparams.ParseUintParam(c, r.serverParam)
		if err != nil {
			return nil, err
		}
		return []Requirement{{Kind: KindServerAccess, ServerID: id}}, nil
	case ruleAdmin:
		return []Requirement{{Kind: KindAdmin, Permission: r.perm}}, nil
	case ruleResolved:
		return r.customFn(c)
	}
	return nil, fmt.Errorf("authz: unknown rule kind %d", r.kind)
}

func (r Rule) parseServerIDAndStack(c echo.Context) (uint, string, error) {
	id, err := echoparams.ParseUintParam(c, r.serverParam)
	if err != nil {
		return 0, "", err
	}
	stack := c.Param(r.stackParam)
	if stack == "" {
		return 0, "", echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("%s is required", r.stackParam))
	}
	if err := validation.ValidateStackName(stack); err != nil {
		return 0, "", echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return id, stack, nil
}

func Public() Rule {
	r := newRule(rulePublic)
	r.public = true
	return r
}

func APIKeyDenied() Rule {
	r := newRule(ruleAPIKeyDenied)
	r.denyAPIKey = true
	return r
}

func Authenticated() Rule {
	return newRule(ruleAuthenticated)
}

func (r Rule) WithListScope() Rule {
	r.listScope = true
	return r
}

func Stack(perm string) Rule {
	r := newRule(ruleStack)
	r.perm = perm
	return r
}

func Server(perm string) Rule {
	r := newRule(ruleServer)
	r.perm = perm
	return r
}

func ServerAccess() Rule {
	return newRule(ruleServerAccess)
}

func Admin(perm string) Rule {
	r := newRule(ruleAdmin)
	r.perm = perm
	return r
}

func Resolved(fn func(echo.Context) ([]Requirement, error)) Rule {
	r := newRule(ruleResolved)
	r.customFn = fn
	return r
}

func (r Rule) WithParams(serverParam string, stackParam ...string) Rule {
	r.serverParam = serverParam
	if len(stackParam) > 0 && stackParam[0] != "" {
		r.stackParam = stackParam[0]
	}
	return r
}

func (r Rule) RequireAPIKeyScope(perm string) Rule {
	r.apiKeyPerm = perm
	return r
}
