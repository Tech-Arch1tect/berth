package websocket

import (
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/session"
)

type Handler struct {
	hub        *Hub
	jwtService *jwt.Service
}

func NewHandler(hub *Hub, jwtService *jwt.Service) *Handler {
	return &Handler{
		hub:        hub,
		jwtService: jwtService,
	}
}

func (h *Handler) HandleWebUIWebSocket(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return c.JSON(401, map[string]string{
			"error": "Not authenticated",
		})
	}

	wsUser := &User{
		ID:   int(userID),
		Name: "",
	}

	return h.hub.ServeWebSocket(c, wsUser)
}

func (h *Handler) HandleFlutterWebSocket(c echo.Context) error {
	var token string

	auth := c.Request().Header.Get("Authorization")
	if after, ok := strings.CutPrefix(auth, "Bearer "); ok {
		token = after
	} else {
		token = c.QueryParam("token")
	}

	if token == "" {
		return c.JSON(401, map[string]string{
			"error": "Authorization token required",
		})
	}

	claims, err := h.jwtService.ValidateToken(token)
	if err != nil {
		return c.JSON(401, map[string]string{
			"error": "Invalid token",
		})
	}

	userID := int(claims.UserID)

	wsUser := &User{
		ID:   userID,
		Name: "", // We'll get name from database if needed later
	}

	return h.hub.ServeWebSocket(c, wsUser)
}

func (h *Handler) HandleOperationsWebSocket(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return c.JSON(401, map[string]string{
			"error": "Not authenticated",
		})
	}

	wsUser := &User{
		ID:   int(userID),
		Name: "", // We'll get name from database if needed later
	}

	return h.hub.ServeWebSocket(c, wsUser)
}

func (h *Handler) HandleFlutterOperationsWebSocket(c echo.Context) error {
	var token string

	auth := c.Request().Header.Get("Authorization")
	if after, ok := strings.CutPrefix(auth, "Bearer "); ok {
		token = after
	} else {
		token = c.QueryParam("token")
	}

	if token == "" {
		return c.JSON(401, map[string]string{
			"error": "Authorization token required",
		})
	}

	claims, err := h.jwtService.ValidateToken(token)
	if err != nil {
		return c.JSON(401, map[string]string{
			"error": "Invalid token",
		})
	}

	userID := int(claims.UserID)

	wsUser := &User{
		ID:   userID,
		Name: "", // We'll get name from database if needed later
	}

	return h.hub.ServeWebSocket(c, wsUser)
}
