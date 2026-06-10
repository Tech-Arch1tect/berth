//go:build e2e

package testsupport

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
)

var ErrRegisterHandlerPathRequired = errors.New("path required")

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
	if err := validation.BindAndValidate(c, &in); err != nil {
		return err
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
	if err := validation.BindAndValidate(c, &in); err != nil {
		return err
	}
	res, err := h.svc.SeedServerWithAgent(in)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, res)
}

type registerHandlerInput struct {
	Path        string          `json:"path"`
	Status      int             `json:"status"`
	Body        json.RawMessage `json:"body"`
	ContentType string          `json:"content_type"`
	RawBody     string          `json:"raw_body"`
}

func (i *registerHandlerInput) Validate() error {
	if i.Path == "" {
		return ErrRegisterHandlerPathRequired
	}
	return nil
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
	if err := validation.BindAndValidate(c, &in); err != nil {
		return err
	}
	status := in.Status
	if status == 0 {
		status = http.StatusOK
	}

	if in.RawBody != "" {
		contentType := in.ContentType
		if contentType == "" {
			contentType = "text/plain"
		}
		agent.RegisterRaw(in.Path, status, contentType, in.RawBody)
		return c.NoContent(http.StatusNoContent)
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

type pushStackEventInput struct {
	Event json.RawMessage `json:"event"`
}

func (i *pushStackEventInput) Validate() error {
	if len(i.Event) == 0 {
		return ErrStackEventRequired
	}
	return nil
}

func (h *Handler) PushStackEvent(c echo.Context) error {
	var in pushStackEventInput
	if err := validation.BindAndValidate(c, &in); err != nil {
		return err
	}
	if err := h.svc.PublishStackEvent(in.Event); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
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
