package e2e

import (
	"fmt"
	"testing"
	"time"

	"berth/internal/domain/auth/tokens"

	e2etesting "berth/e2e/internal/harness"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func craftAccessToken(t *testing.T, app *TestApp, userID uint, issuer, audience string) string {
	t.Helper()
	now := time.Now()
	jti := uuid.NewString()
	claims := tokens.Claims{
		UserID: userID,
		JTI:    jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Issuer:    issuer,
			Subject:   fmt.Sprintf("%d", userID),
			Audience:  jwt.ClaimStrings{audience},
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(app.Config.JWT.SecretKey))
	if err != nil {
		t.Fatalf("sign crafted token: %v", err)
	}
	return signed
}

func TestJWTIssuerAudienceValidation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	validIssuer := app.Config.JWT.Issuer

	t.Run("token with wrong issuer is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "jwt_iss_wrong",
			Email:    "jwt_iss_wrong@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		token := craftAccessToken(t, app, user.ID, "evil-issuer", validIssuer)
		assert.Equal(t, 401, apiGetProfile(t, app, token),
			"a correctly-signed token issued by another service must be rejected")
	})

	t.Run("token with wrong audience is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "jwt_aud_wrong",
			Email:    "jwt_aud_wrong@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		token := craftAccessToken(t, app, user.ID, validIssuer, "evil-audience")
		assert.Equal(t, 401, apiGetProfile(t, app, token),
			"a correctly-signed token addressed to another audience must be rejected")
	})

	t.Run("token with correct issuer and audience is accepted", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
		user := &e2etesting.TestUser{
			Username: "jwt_iss_aud_ok",
			Email:    "jwt_iss_aud_ok@example.com",
			Password: "password123",
		}
		app.AuthHelper.CreateTestUser(t, user)

		token := craftAccessToken(t, app, user.ID, validIssuer, validIssuer)
		assert.Equal(t, 200, apiGetProfile(t, app, token),
			"the crafted-token path itself is valid; only iss/aud mismatch must reject")
	})
}
