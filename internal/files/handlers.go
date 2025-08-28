package files

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) ShowFileManager(c echo.Context) error {
	return c.Render(http.StatusOK, "files/index", map[string]any{
		"title": "File Manager",
	})
}
