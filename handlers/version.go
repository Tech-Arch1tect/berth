package handlers

import (
	"berth/version"
	"net/http"

	"github.com/labstack/echo/v4"
)

type VersionHandler struct{}

func NewVersionHandler() *VersionHandler {
	return &VersionHandler{}
}

func (h *VersionHandler) GetVersion(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"version": version.Version,
	})
}
