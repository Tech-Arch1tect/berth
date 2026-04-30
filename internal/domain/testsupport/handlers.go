//go:build e2e

package testsupport

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Reset(c echo.Context) error {
	if err := h.svc.Reset(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) SeedUser(c echo.Context) error {
	var in SeedUserInput
	if err := c.Bind(&in); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	res, err := h.svc.SeedUser(in)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handler) EnableTOTP(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid user id")
	}
	if err := h.svc.EnableTOTP(uint(id)); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) SeedServer(c echo.Context) error {
	var in SeedServerInput
	if err := c.Bind(&in); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	res, err := h.svc.SeedServerWithAgent(in)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, res)
}

type registerHandlerInput struct {
	Path   string          `json:"path"`
	Status int             `json:"status"`
	Body   json.RawMessage `json:"body"`
}

func (h *Handler) RegisterAgentHandler(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid agent id")
	}
	agent, ok := h.svc.GetAgent(id)
	if !ok {
		return echo.NewHTTPError(http.StatusNotFound, "agent not found")
	}

	var in registerHandlerInput
	if err := c.Bind(&in); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if in.Path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path required")
	}
	status := in.Status
	if status == 0 {
		status = http.StatusOK
	}

	body := in.Body
	agent.RegisterHandler(in.Path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if len(body) > 0 {
			_, _ = w.Write(body)
		}
	})
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) ResetAgent(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid agent id")
	}
	agent, ok := h.svc.GetAgent(id)
	if !ok {
		return echo.NewHTTPError(http.StatusNotFound, "agent not found")
	}
	agent.ResetHandlers()
	return c.NoContent(http.StatusNoContent)
}
