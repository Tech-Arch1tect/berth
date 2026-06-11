package e2e

import (
	"crypto/rand"
	"crypto/rsa"
	"fmt"
	"testing"
	"time"

	"berth/internal/domain/auth/tokens"

	e2etesting "berth/e2e/internal/harness"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func accessClaims(userID uint, issuer, audience string, expiry time.Time) tokens.Claims {
	now := time.Now()
	jti := uuid.NewString()
	return tokens.Claims{
		UserID: userID,
		JTI:    jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Issuer:    issuer,
			Subject:   fmt.Sprintf("%d", userID),
			Audience:  jwt.ClaimStrings{audience},
			ExpiresAt: jwt.NewNumericDate(expiry),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
}

func signHS256(t *testing.T, secret string, claims tokens.Claims) string {
	t.Helper()
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign HS256 token: %v", err)
	}
	return signed
}

func craftAccessToken(t *testing.T, app *TestApp, userID uint, issuer, audience string) string {
	t.Helper()
	return signHS256(t, app.Config.JWT.SecretKey,
		accessClaims(userID, issuer, audience, time.Now().Add(15*time.Minute)))
}

func profileStatusWithAuthHeader(t *testing.T, app *TestApp, header string) int {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method:  "GET",
		Path:    "/api/v1/profile",
		Headers: map[string]string{"Authorization": header},
	})
	require.NoError(t, err)
	return resp.StatusCode
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

		token := signHS256(t, app.Config.JWT.SecretKey,
			accessClaims(user.ID, "evil-issuer", validIssuer, time.Now().Add(15*time.Minute)))
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

		token := signHS256(t, app.Config.JWT.SecretKey,
			accessClaims(user.ID, validIssuer, "evil-audience", time.Now().Add(15*time.Minute)))
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

func TestJWTSignatureNegatives(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	issuer := app.Config.JWT.Issuer

	user := &e2etesting.TestUser{
		Username: "jwt_sig_neg",
		Email:    "jwt_sig_neg@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("tampered signature is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		token := craftAccessToken(t, app, user.ID, issuer, issuer)
		assert.Equal(t, 401, apiGetProfile(t, app, tamperSignature(token)),
			"flipping a byte in the signature must invalidate the token")
	})

	t.Run("signature from a different secret is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		token := signHS256(t, "an-attacker-controlled-secret-not-the-server-one",
			accessClaims(user.ID, issuer, issuer, time.Now().Add(15*time.Minute)))
		assert.Equal(t, 401, apiGetProfile(t, app, token),
			"a token signed with the wrong secret must be rejected")
	})
}

func TestJWTAlgorithmConfusion(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	issuer := app.Config.JWT.Issuer

	user := &e2etesting.TestUser{
		Username: "jwt_alg_conf",
		Email:    "jwt_alg_conf@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)
	claims := accessClaims(user.ID, issuer, issuer, time.Now().Add(15*time.Minute))

	t.Run("alg=none token is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		token, err := jwt.NewWithClaims(jwt.SigningMethodNone, claims).
			SignedString(jwt.UnsafeAllowNoneSignatureType)
		require.NoError(t, err)
		assert.Equal(t, 401, apiGetProfile(t, app, token),
			"an unsigned alg=none token must not be accepted by the HS256-only verifier")
	})

	t.Run("RS256 token is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
		require.NoError(t, err)
		token, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(rsaKey)
		require.NoError(t, err)
		assert.Equal(t, 401, apiGetProfile(t, app, token),
			"an RS256 token must not be accepted by the HS256-only verifier")
	})
}

func TestJWTExpiry(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)
	issuer := app.Config.JWT.Issuer

	user := &e2etesting.TestUser{
		Username: "jwt_expired",
		Email:    "jwt_expired@example.com",
		Password: "password123",
	}
	app.AuthHelper.CreateTestUser(t, user)

	t.Run("expired access token is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		token := signHS256(t, app.Config.JWT.SecretKey,
			accessClaims(user.ID, issuer, issuer, time.Now().Add(-time.Hour)))
		assert.Equal(t, 401, apiGetProfile(t, app, token),
			"a token past its exp must be rejected")
	})
}

func TestAuthHeaderNegatives(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	t.Run("non-Bearer scheme is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueMedium)
		for _, header := range []string{"Token abc123", "Basic dXNlcjpwYXNz", "bearer abc123"} {
			assert.Equal(t, 401, profileStatusWithAuthHeader(t, app, header),
				"Authorization %q must be rejected", header)
		}
	})

	t.Run("empty Bearer token is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategoryNoAuth, e2etesting.ValueMedium)
		assert.Equal(t, 401, profileStatusWithAuthHeader(t, app, "Bearer "),
			"a Bearer header carrying no token must be rejected")
	})

	t.Run("garbage Bearer token is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueMedium)
		assert.Equal(t, 401, profileStatusWithAuthHeader(t, app, "Bearer not-a-jwt-and-not-an-api-key"),
			"a Bearer token that is neither a JWT nor an API key must be rejected")
	})

	t.Run("refresh token used as access Bearer is rejected", func(t *testing.T) {
		TagTest(t, "GET", "/api/v1/profile", e2etesting.CategorySecurity, e2etesting.ValueHigh)
		login := apiLogin(t, app, "jwt_refresh_as_access", "jwt_refresh_as_access@example.com", "password123")
		require.NotEmpty(t, login.Data.RefreshToken)
		assert.Equal(t, 401, apiGetProfile(t, app, login.Data.RefreshToken),
			"the opaque refresh token must not authenticate a protected route")
	})
}

func tamperSignature(token string) string {
	if len(token) < 2 {
		return token
	}
	i := len(token) - 2
	replacement := "a"
	if token[i] == 'a' {
		replacement = "b"
	}
	return token[:i] + replacement + token[i+1:]
}
