package version

import (
	"net/http"

	appversion "berth/version"

	"github.com/labstack/echo/v4"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) GetVersion(c echo.Context) error {
	return c.JSON(http.StatusOK, GetVersionResponse{
		Success: true,
		Data: VersionData{
			Version: appversion.Version,
		},
	})
}
