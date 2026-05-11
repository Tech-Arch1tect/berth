package harness

import (
	"testing"

	"berth/internal/domain/auth"
	"berth/internal/pkg/response"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type AuthHelper struct {
	HTTPClient *HTTPClient
	DB         *gorm.DB
	AuthSvc    *auth.Service
}

type TestUser struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func NewAuthHelper(httpClient *HTTPClient, db *gorm.DB, authSvc *auth.Service) *AuthHelper {
	return &AuthHelper{
		HTTPClient: httpClient,
		DB:         db,
		AuthSvc:    authSvc,
	}
}

func (h *AuthHelper) CreateTestUser(t *testing.T, user *TestUser) {

	hashedPassword, err := h.AuthSvc.HashPassword(user.Password)
	require.NoError(t, err, "failed to hash test user password")

	err = h.DB.Table("users").Create(map[string]interface{}{
		"username": user.Username,
		"email":    user.Email,
		"password": hashedPassword,
	}).Error
	require.NoError(t, err, "failed to create test user")

	var dbUser struct {
		ID uint `json:"id"`
	}
	err = h.DB.Table("users").Where("email = ?", user.Email).First(&dbUser).Error
	require.NoError(t, err, "failed to retrieve created test user")

	user.ID = dbUser.ID
}

func (h *AuthHelper) GetPasswordResetToken(t *testing.T, email string) string {
	var tokens []string
	err := h.DB.Table("password_reset_tokens").
		Select("token").
		Where("email = ? AND used = ?", email, false).
		Order("created_at DESC").
		Limit(1).
		Pluck("token", &tokens).Error

	require.NoError(t, err, "failed to find password reset token")
	require.NotEmpty(t, tokens, "no password reset token found")
	return tokens[0]
}

func (h *AuthHelper) AssertEmailVerified(t *testing.T, email string) {
	var count int64
	err := h.DB.Table("users").
		Where("email = ? AND email_verified_at IS NOT NULL", email).
		Count(&count).Error
	require.NoError(t, err, "failed to check email verification status")
	require.Equal(t, int64(1), count, "email should be verified")
}

func (h *AuthHelper) AssertEmailNotVerified(t *testing.T, email string) {
	var count int64
	err := h.DB.Table("users").
		Where("email = ? AND email_verified_at IS NULL", email).
		Count(&count).Error
	require.NoError(t, err, "failed to check email verification status")
	require.Equal(t, int64(1), count, "email should not be verified")
}

func (h *AuthHelper) EnableTOTPForUser(t *testing.T, userID uint) {
	err := h.DB.Table("totp_secrets").Create(map[string]interface{}{
		"user_id": userID,
		"secret":  "TESTSECRET1234567890123456",
		"enabled": true,
	}).Error
	require.NoError(t, err, "failed to enable TOTP for test user")
}

func (h *AuthHelper) JWTLogin(t *testing.T, username, password string) string {
	t.Helper()
	resp, err := h.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: username,
		Password: password,
	})
	require.NoError(t, err, "JWT login request failed")
	require.Equal(t, 200, resp.StatusCode, "JWT login should succeed")

	var login response.Response[auth.AuthLoginData]
	require.NoError(t, resp.GetJSON(&login), "JWT login response should decode")
	require.True(t, login.Success, "JWT login response should be success")
	require.NotEmpty(t, login.Data.AccessToken, "JWT login should return access token")
	return login.Data.AccessToken
}
