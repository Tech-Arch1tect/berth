package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"berth/internal/domain/auth/tokens"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/config"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type stubUserProvider struct {
	user any
	err  error
}

func (s stubUserProvider) GetUser(uint) (any, error) { return s.user, s.err }

func newTestJWTService(t *testing.T) *tokens.Service {
	t.Helper()
	cfg := &config.Config{}
	cfg.JWT.SecretKey = "unit-test-jwt-secret-key-at-least-32"
	cfg.JWT.Issuer = "berth"
	cfg.JWT.AccessExpiry = 15 * time.Minute
	svc, err := tokens.NewService(cfg, nil, zap.NewNop())
	require.NoError(t, err)
	return svc
}

func TestRequireAuthJWT_RejectsTokenForMissingUser(t *testing.T) {
	jwtSvc := newTestJWTService(t)
	token, err := jwtSvc.IssueAccessToken(42)
	require.NoError(t, err)

	run := func(provider UserProvider) (handlerRan bool, mwErr error) {
		mw := RequireAuth(jwtSvc, nil, provider)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/profile", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		c := echo.New().NewContext(req, httptest.NewRecorder())
		mwErr = mw(func(c echo.Context) error {
			handlerRan = true
			return c.NoContent(http.StatusOK)
		})(c)
		return handlerRan, mwErr
	}

	t.Run("soft-deleted or missing user is rejected", func(t *testing.T) {
		ran, err := run(stubUserProvider{user: nil, err: gorm.ErrRecordNotFound})
		assert.False(t, ran, "the handler must not run once the user is gone")
		he, ok := err.(*echo.HTTPError)
		require.True(t, ok, "expected an echo.HTTPError, got %v", err)
		assert.Equal(t, http.StatusUnauthorized, he.Code)
	})

	t.Run("live user is allowed through", func(t *testing.T) {
		ran, err := run(stubUserProvider{user: usermodel.User{}, err: nil})
		assert.NoError(t, err)
		assert.True(t, ran, "a token for a live user must reach the handler")
	})
}
