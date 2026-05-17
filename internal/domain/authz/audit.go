package authz

import (
	"fmt"
	"sort"
	"strings"

	"github.com/labstack/echo/v4"
)

func AuditRoutes(e *echo.Echo, registrars ...*Registrar) error {
	authorised := make(map[string]struct{})
	for _, reg := range registrars {
		for _, rr := range reg.RegisteredRoutes() {
			authorised[rr.Method+" "+rr.Path] = struct{}{}
		}
	}

	seen := make(map[string]struct{})
	var violations []string
	for _, route := range e.Routes() {
		if !strings.HasPrefix(route.Path, "/api") && !strings.HasPrefix(route.Path, "/ws") {
			continue
		}
		key := route.Method + " " + route.Path
		if _, already := seen[key]; already {
			continue
		}
		seen[key] = struct{}{}
		if _, ok := authorised[key]; !ok {
			violations = append(violations, key)
		}
	}

	if len(violations) == 0 {
		return nil
	}
	sort.Strings(violations)
	return fmt.Errorf("authz: unguarded routes: %s", strings.Join(violations, ", "))
}

func MustAuditRoutes(e *echo.Echo, registrars ...*Registrar) {
	if err := AuditRoutes(e, registrars...); err != nil {
		panic(err)
	}
}
