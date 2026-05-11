package e2e

import (
	"strings"
	"testing"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/require"
)

func verifyUser(t *testing.T, app *TestApp, user *e2etesting.TestUser) {
	t.Helper()
	err := app.DB.Table("users").
		Where("id = ?", user.ID).
		Update("email_verified_at", "2026-01-01 00:00:00").Error
	require.NoError(t, err, "failed to verify test user email")
}

func extractTokenFromURL(t *testing.T, resetURL string) string {
	t.Helper()
	const marker = "token="
	idx := strings.Index(resetURL, marker)
	require.NotEqual(t, -1, idx, "reset URL should contain token= parameter: %s", resetURL)
	return resetURL[idx+len(marker):]
}

func extractTokenFromCapturedMail(t *testing.T, app *TestApp) string {
	t.Helper()
	resetMails := app.Mail.ByTemplate("password_reset")
	require.NotEmpty(t, resetMails, "expected at least one password_reset email")
	last := resetMails[len(resetMails)-1]
	resetURL, ok := last.Data["ResetURL"].(string)
	require.True(t, ok, "ResetURL should be a string")
	return extractTokenFromURL(t, resetURL)
}

func extractVerificationTokenFromURL(t *testing.T, verificationURL string) string {
	t.Helper()
	const marker = "token="
	idx := strings.Index(verificationURL, marker)
	require.NotEqual(t, -1, idx, "verification URL should contain token= parameter: %s", verificationURL)
	return verificationURL[idx+len(marker):]
}

func extractVerificationTokenFromCapturedMail(t *testing.T, app *TestApp) string {
	t.Helper()
	mails := app.Mail.ByTemplate("email_verification")
	require.NotEmpty(t, mails, "expected at least one email_verification email")
	last := mails[len(mails)-1]
	verificationURL, ok := last.Data["VerificationURL"].(string)
	require.True(t, ok, "VerificationURL should be a string")
	return extractVerificationTokenFromURL(t, verificationURL)
}
