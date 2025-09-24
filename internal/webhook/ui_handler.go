package webhook

import (
	"berth/internal/server"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v2"
	"github.com/tech-arch1tect/brx/services/inertia"
	"github.com/tech-arch1tect/brx/session"
)

type UIHandler struct {
	webhookSvc *Service
	serverSvc  *server.Service
	inertiaSvc *inertia.Service
}

func NewUIHandler(webhookSvc *Service, serverSvc *server.Service, inertiaSvc *inertia.Service) *UIHandler {
	return &UIHandler{
		webhookSvc: webhookSvc,
		serverSvc:  serverSvc,
		inertiaSvc: inertiaSvc,
	}
}

func (h *UIHandler) Index(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)

	webhooks, err := h.webhookSvc.GetUserWebhooks(userID)
	if err != nil {
		return err
	}

	servers, err := h.serverSvc.ListServersForUser(userID)
	if err != nil {
		return err
	}

	return h.inertiaSvc.Render(c, "Webhooks", gonertia.Props{
		"title":    "Webhooks",
		"webhooks": webhooks,
		"servers":  servers,
	})
}
