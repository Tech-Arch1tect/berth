package harness

import (
	"fmt"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx/services/auth"
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

func (h *AuthHelper) Login(username, password string) (*Response, error) {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()
	return h.LoginWithClient(client, username, password)
}

func (h *AuthHelper) LoginWithClient(client *HTTPClient, username, password string) (*Response, error) {
	if _, err := client.Get("/auth/login"); err != nil {
		return nil, err
	}
	return client.PostForm("/auth/login", url.Values{
		"username": {username},
		"password": {password},
	})
}

func (h *AuthHelper) LoginWithRememberMe(username, password string) (*Response, error) {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/login"); err != nil {
		return nil, err
	}
	return client.PostForm("/auth/login", url.Values{
		"username":    {username},
		"password":    {password},
		"remember_me": {"true"},
	})
}

func (h *AuthHelper) Register(username, email, password string) (*Response, error) {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/login"); err != nil {
		return nil, err
	}
	return client.PostForm("/auth/register", url.Values{
		"username": {username},
		"email":    {email},
		"password": {password},
	})
}

func (h *AuthHelper) Logout() (*Response, error) {
	return h.HTTPClient.PostForm("/auth/logout", url.Values{})
}

func (h *AuthHelper) RequestPasswordReset(email string) (*Response, error) {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/password-reset"); err != nil {
		return nil, err
	}
	return client.PostForm("/auth/password-reset", url.Values{
		"email": {email},
	})
}

func (h *AuthHelper) ResetPassword(token, newPassword string) (*Response, error) {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/password-reset/confirm"); err != nil {
		return nil, err
	}
	return client.PostForm("/auth/password-reset/confirm", url.Values{
		"token":            {token},
		"password":         {newPassword},
		"password_confirm": {newPassword},
	})
}

func (h *AuthHelper) VerifyEmail(token string) (*Response, error) {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/verify-email"); err != nil {
		return nil, err
	}
	return client.Post(fmt.Sprintf("/auth/verify-email?token=%s", token), nil)
}

func (h *AuthHelper) ResendVerification(email string) (*Response, error) {
	client := h.HTTPClient.WithCookieJar().WithoutRedirects()
	if _, err := client.Get("/auth/login"); err != nil {
		return nil, err
	}
	return client.PostForm("/auth/resend-verification", url.Values{
		"email": {email},
	})
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

func (h *AuthHelper) GetEmailVerificationToken(t *testing.T, email string) string {
	var tokens []string
	err := h.DB.Table("email_verification_tokens").
		Select("token").
		Where("email = ? AND used = ?", email, false).
		Order("created_at DESC").
		Limit(1).
		Pluck("token", &tokens).Error

	require.NoError(t, err, "failed to find email verification token")
	require.NotEmpty(t, tokens, "no email verification token found")
	return tokens[0]
}

func (h *AuthHelper) AssertUserExists(t *testing.T, email string) {
	var count int64
	err := h.DB.Table("users").Where("email = ?", email).Count(&count).Error
	require.NoError(t, err, "failed to check if user exists")
	require.Equal(t, int64(1), count, "user should exist")
}

func (h *AuthHelper) AssertUserNotExists(t *testing.T, email string) {
	var count int64
	err := h.DB.Table("users").Where("email = ?", email).Count(&count).Error
	require.NoError(t, err, "failed to check if user exists")
	require.Equal(t, int64(0), count, "user should not exist")
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

func (h *AuthHelper) GetLoginForm() (*Response, error) {
	return h.HTTPClient.Get("/auth/login")
}

func (h *AuthHelper) GetRegisterForm() (*Response, error) {
	return h.HTTPClient.Get("/auth/register")
}

func (h *AuthHelper) GetPasswordResetForm() (*Response, error) {
	return h.HTTPClient.Get("/auth/password-reset")
}

func (h *AuthHelper) AssertLoginSuccess(t *testing.T, resp *Response) {
	resp.AssertRedirect(t, "/")
}

func (h *AuthHelper) AssertLoginFailed(t *testing.T, resp *Response) {
	resp.AssertRedirect(t, "/auth/login")
}

func (h *AuthHelper) AssertRegistrationSuccess(t *testing.T, resp *Response) {

	resp.AssertRedirect(t, "/")
}

func (h *AuthHelper) CleanAuthTables() error {
	tables := []string{
		"users",
		"password_reset_tokens",
		"email_verification_tokens",
		"remember_me_tokens",
	}

	for _, table := range tables {
		if err := h.DB.Exec("DELETE FROM " + table).Error; err != nil {
			return fmt.Errorf("failed to clean table %s: %w", table, err)
		}
	}

	return nil
}

func (h *AuthHelper) EnableTOTPForUser(t *testing.T, userID uint) {
	err := h.DB.Table("totp_secrets").Create(map[string]interface{}{
		"user_id": userID,
		"secret":  "TESTSECRET1234567890123456",
		"enabled": true,
	}).Error
	require.NoError(t, err, "failed to enable TOTP for test user")
}
