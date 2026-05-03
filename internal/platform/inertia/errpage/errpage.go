package errpage

import (
	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
)

type PageRenderer interface {
	Render(c echo.Context, component string, props gonertia.Props) error
}

type Renderer struct {
	pages PageRenderer
}

func New(pages PageRenderer) *Renderer {
	return &Renderer{pages: pages}
}

func (r *Renderer) Render(c echo.Context, status int, message string) error {
	c.Response().WriteHeader(status)
	return r.pages.Render(c, "Errors/Generic", gonertia.Props{
		"code":    status,
		"message": message,
	})
}
