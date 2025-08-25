package websocket

import (
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/session"
)

type Handler struct {
	hub         *Hub
	jwtService  *jwt.Service
	permChecker PermissionChecker
}

func NewHandler(hub *Hub, jwtService *jwt.Service, permChecker PermissionChecker) *Handler {
	return &Handler{
		hub:         hub,
		jwtService:  jwtService,
		permChecker: permChecker,
	}
}

func (h *Handler) HandleWebUIWebSocket(c echo.Context) error {
	userID := session.GetUserIDAsUint(c)
	if userID == 0 {
		return c.JSON(401, map[string]string{
			"error": "Not authenticated",
		})
	}

	serverIDStr := c.Param("server_id")
	serverID, err := strconv.Atoi(serverIDStr)
	if err != nil {
		return c.JSON(400, map[string]string{
			"error": "Invalid server ID",
		})
	}

	if !h.permChecker.CanUserAccessServer(int(userID), serverID) {
		return c.JSON(403, map[string]string{
			"error": "Insufficient permissions to access this server",
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

	serverIDStr := c.Param("server_id")
	serverID, err := strconv.Atoi(serverIDStr)
	if err != nil {
		return c.JSON(400, map[string]string{
			"error": "Invalid server ID",
		})
	}

	if !h.permChecker.CanUserAccessServer(userID, serverID) {
		return c.JSON(403, map[string]string{
			"error": "Insufficient permissions to access this server",
		})
	}

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
