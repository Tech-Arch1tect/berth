package auth

import (
	"net/http"
	"strings"

	"berth/internal/domain/apikey"
	tokens "berth/internal/domain/auth/tokens"
	"berth/internal/domain/authz"
	"berth/internal/domain/security"
	usermodel "berth/internal/domain/user"

	"github.com/labstack/echo/v4"
)

const (
	UserIDKey = "_jwt_user_id"

	wsProtocolBearer = "Bearer"
)

type APIKeyAuthAuditor interface {
	LogAPIEvent(eventType string, userID *uint, username, ip, userAgent string, success bool, failureReason string, metadata map[string]any) error
}

func RequireAuth(jwtService *tokens.Service, apiKeyService *apikey.Service, userProvider UserProvider, auditor APIKeyAuthAuditor) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			wsProto := c.Request().Header.Get("Sec-WebSocket-Protocol")

			if authHeader != "" && wsProto != "" {
				return echo.NewHTTPError(http.StatusBadRequest, "Ambiguous authentication: set either Authorization or Sec-WebSocket-Protocol, not both")
			}

			var tokenString string
			switch {
			case authHeader != "":
				if !strings.HasPrefix(authHeader, "Bearer ") {
					return echo.NewHTTPError(http.StatusUnauthorized, "Invalid authorization header format")
				}
				tokenString = strings.TrimPrefix(authHeader, "Bearer ")
				if tokenString == "" {
					return echo.NewHTTPError(http.StatusUnauthorized, "Token required")
				}
			case wsProto != "":
				token, ok := tokenFromWSSubprotocol(wsProto)
				if !ok {
					return echo.NewHTTPError(http.StatusUnauthorized, "Invalid Sec-WebSocket-Protocol format")
				}
				tokenString = token
			default:
				return echo.NewHTTPError(http.StatusUnauthorized, "Authorization header required")
			}

			if strings.HasPrefix(tokenString, apikey.KeyPrefix) {
				return handleAPIKeyAuth(c, next, apiKeyService, auditor, tokenString)
			}

			return handleJWTAuth(c, next, jwtService, userProvider, tokenString)
		}
	}
}

func tokenFromWSSubprotocol(value string) (string, bool) {
	parts := strings.Split(value, ",")
	if len(parts) != 2 {
		return "", false
	}
	if strings.TrimSpace(parts[0]) != wsProtocolBearer {
		return "", false
	}
	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", false
	}
	return token, true
}

func handleAPIKeyAuth(c echo.Context, next echo.HandlerFunc, apiKeyService *apikey.Service, auditor APIKeyAuthAuditor, key string) error {
	user, apiKey, err := apiKeyService.ValidateAPIKey(key)
	if err != nil {
		if auditor != nil {
			_ = auditor.LogAPIEvent(security.EventAPIKeyValidationFailed, nil, "", c.RealIP(), c.Request().UserAgent(), false, err.Error(), nil)
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication failed")
	}

	c.Set(UserIDKey, user.ID)
	c.Set("currentUser", *user)

	authz.SetPrincipal(c, authz.NewPrincipal(user.ID, hasAdminRole(user.Roles), keyDescriptor(apiKey)))

	return next(c)
}

func keyDescriptor(apiKey *apikey.APIKey) *authz.KeyDescriptor {
	scopes := make([]authz.KeyScope, 0, len(apiKey.Scopes))
	for _, scope := range apiKey.Scopes {
		scopes = append(scopes, authz.KeyScope{
			ServerID:     scope.ServerID,
			StackPattern: scope.StackPattern,
			Permission:   scope.Permission.Name,
		})
	}
	return &authz.KeyDescriptor{ID: apiKey.ID, Scopes: scopes}
}

func hasAdminRole(roles []usermodel.Role) bool {
	for _, role := range roles {
		if role.IsAdmin {
			return true
		}
	}
	return false
}

func handleJWTAuth(c echo.Context, next echo.HandlerFunc, jwtService *tokens.Service, userProvider UserProvider, tokenString string) error {
	claims, err := jwtService.ValidateAccess(tokenString)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication failed")
	}

	if userProvider != nil {
		user, err := userProvider.GetUser(claims.UserID)
		if err != nil || user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Authentication failed")
		}
		c.Set("currentUser", user)

		if u, ok := user.(usermodel.User); ok {
			authz.SetPrincipal(c, authz.NewPrincipal(u.ID, hasAdminRole(u.Roles), nil))
		}
	}

	c.Set(UserIDKey, claims.UserID)

	return next(c)
}

func GetUserID(c echo.Context) uint {
	if userID, ok := c.Get(UserIDKey).(uint); ok {
		return userID
	}
	return 0
}
