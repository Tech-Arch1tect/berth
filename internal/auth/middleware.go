package auth

import (
	"berth/internal/apikey"
	"berth/models"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	jwtservice "github.com/tech-arch1tect/brx/services/jwt"
)

const (
	UserIDKey   = "_jwt_user_id"
	ClaimsKey   = "_jwt_claims"
	AuthTypeKey = "_auth_type"
	APIKeyKey   = "_api_key"
)

type AuthType string

const (
	AuthTypeJWT    AuthType = "jwt"
	AuthTypeAPIKey AuthType = "apikey"
)

func RequireAuth(jwtService *jwtservice.Service, apiKeyService *apikey.Service, userProvider jwtshared.UserProvider) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Authorization header required")
			}

			if !strings.HasPrefix(authHeader, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid authorization header format")
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Token required")
			}

			if strings.HasPrefix(tokenString, apikey.KeyPrefix) {
				return handleAPIKeyAuth(c, next, apiKeyService, tokenString)
			}

			return handleJWTAuth(c, next, jwtService, userProvider, tokenString)
		}
	}
}

func handleAPIKeyAuth(c echo.Context, next echo.HandlerFunc, apiKeyService *apikey.Service, key string) error {
	user, apiKey, err := apiKeyService.ValidateAPIKey(key)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication failed")
	}

	c.Set(UserIDKey, user.ID)
	c.Set(AuthTypeKey, AuthTypeAPIKey)
	c.Set(APIKeyKey, apiKey)

	c.Set("currentUser", *user)

	return next(c)
}

func handleJWTAuth(c echo.Context, next echo.HandlerFunc, jwtService *jwtservice.Service, userProvider jwtshared.UserProvider, tokenString string) error {
	claims, err := jwtService.ValidateToken(tokenString)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Authentication failed")
	}

	c.Set(UserIDKey, claims.UserID)
	c.Set(ClaimsKey, claims)
	c.Set(AuthTypeKey, AuthTypeJWT)

	if userProvider != nil {
		user, err := userProvider.GetUser(claims.UserID)
		if err == nil && user != nil {
			c.Set("currentUser", user)
		}
	}

	return next(c)
}

func GetAuthType(c echo.Context) AuthType {
	if authType, ok := c.Get(AuthTypeKey).(AuthType); ok {
		return authType
	}
	return ""
}

func GetAPIKey(c echo.Context) *models.APIKey {
	if apiKey, ok := c.Get(APIKeyKey).(*models.APIKey); ok {
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

func GetUser(c echo.Context) *models.User {
	if user := jwtshared.GetCurrentUser(c); user != nil {
		if userModel, ok := user.(models.User); ok {
			return &userModel
		}
	}
	return nil
}

func IsAPIKeyAuth(c echo.Context) bool {
	return GetAuthType(c) == AuthTypeAPIKey
}

func IsJWTAuth(c echo.Context) bool {
	return GetAuthType(c) == AuthTypeJWT
}
