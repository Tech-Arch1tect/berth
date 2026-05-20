package authz

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type RouteRule struct {
	Method string
	Path   string
	Rule   Rule
}

type Registrar struct {
	group  *echo.Group
	prefix string
	mw     func(Rule) echo.MiddlewareFunc
	routes []RouteRule
}

func NewRegistrar(g *echo.Group, prefix string, mw func(Rule) echo.MiddlewareFunc) *Registrar {
	return &Registrar{group: g, prefix: prefix, mw: mw}
}

func (r *Registrar) register(method, path string, h echo.HandlerFunc, rule Rule) {
	r.group.Add(method, path, h, r.mw(rule))
	r.routes = append(r.routes, RouteRule{
		Method: method,
		Path:   r.prefix + path,
		Rule:   rule,
	})
}

func (r *Registrar) GET(path string, h echo.HandlerFunc, rule Rule) {
	r.register(http.MethodGet, path, h, rule)
}

func (r *Registrar) POST(path string, h echo.HandlerFunc, rule Rule) {
	r.register(http.MethodPost, path, h, rule)
}

func (r *Registrar) PUT(path string, h echo.HandlerFunc, rule Rule) {
	r.register(http.MethodPut, path, h, rule)
}

func (r *Registrar) PATCH(path string, h echo.HandlerFunc, rule Rule) {
	r.register(http.MethodPatch, path, h, rule)
}

func (r *Registrar) DELETE(path string, h echo.HandlerFunc, rule Rule) {
	r.register(http.MethodDelete, path, h, rule)
}

func (r *Registrar) RegisteredRoutes() []RouteRule {
	out := make([]RouteRule, len(r.routes))
	copy(out, r.routes)
	return out
}
