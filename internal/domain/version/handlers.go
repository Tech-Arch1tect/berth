package version

import (
	"berth/internal/pkg/response"
	appversion "berth/version"

	"github.com/labstack/echo/v4"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) GetVersion(c echo.Context) error {
	return response.OK(c, VersionData{
		Version: appversion.Version,
	})
}
