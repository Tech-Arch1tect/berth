package auth

import (
	"berth/internal/domain/apikey"
	"context"
	"net/http"
	"strings"

	tokens "berth/internal/domain/auth/tokens"

	"github.com/labstack/echo/v4"
)

const (
	UserIDKey   = "_jwt_user_id"
	AuthTypeKey = "_auth_type"
	APIKeyKey   = "_api_key"

	wsProtocolBearer = "Bearer"
)

type contextKey string

const APIKeyContextKey contextKey = "api_key"

type authType string

const (
	authTypeJWT    authType = "jwt"
	authTypeAPIKey authType = "apikey"
)

func RequireAuth(jwtService *tokens.Service, apiKeyService *apikey.Service, userProvider UserProvider) echo.MiddlewareFunc {
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
				return handleAPIKeyAuth(c, next, apiKeyService, tokenString)
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

func handleAPIKeyAuth(c echo.Context, next echo.HandlerFunc, apiKeyService *apikey.Service, key string) error {
	user, apiKey, err := apiKeyService.ValidateAPIKey(key)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication failed")
	}

	c.Set(UserIDKey, user.ID)
	c.Set(AuthTypeKey, authTypeAPIKey)
	c.Set(APIKeyKey, apiKey)

	c.Set("currentUser", *user)

	ctx := context.WithValue(c.Request().Context(), APIKeyContextKey, apiKey)
	c.SetRequest(c.Request().WithContext(ctx))

	return next(c)
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
	}

	c.Set(UserIDKey, claims.UserID)
	c.Set(AuthTypeKey, authTypeJWT)

	return next(c)
}

func getAuthType(c echo.Context) authType {
	if authType, ok := c.Get(AuthTypeKey).(authType); ok {
		return authType
	}
	return ""
}

func GetAPIKey(c echo.Context) *apikey.APIKey {
	if apiKey, ok := c.Get(APIKeyKey).(*apikey.APIKey); ok {
		return apiKey
	}
	return nil
}

func GetUserID(c echo.Context) uint {
	if userID, ok := c.Get(UserIDKey).(uint); ok {
		return userID
	}
	return 0
}

func IsAPIKeyAuth(c echo.Context) bool {
	return getAuthType(c) == authTypeAPIKey
}

func IsJWTAuth(c echo.Context) bool {
	return getAuthType(c) == authTypeJWT
}

func GetAPIKeyFromContext(ctx context.Context) *apikey.APIKey {
	if apiKey, ok := ctx.Value(APIKeyContextKey).(*apikey.APIKey); ok {
		return apiKey
	}
	return nil
}
