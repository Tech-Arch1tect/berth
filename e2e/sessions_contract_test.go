package e2e

import (
	"testing"

	"berth/internal/domain/auth"
	"berth/internal/domain/session"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func listSessionsViaJWT(t *testing.T, app *TestApp, accessToken string) (response.Response[session.GetSessionsData], int) {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "GET",
		Path:   "/api/v1/sessions",
		Headers: map[string]string{
			"Authorization": "Bearer " + accessToken,
		},
	})
	require.NoError(t, err)
	if resp.StatusCode != 200 {
		return response.Response[session.GetSessionsData]{}, resp.StatusCode
	}
	var out response.Response[session.GetSessionsData]
	require.NoError(t, resp.GetJSON(&out))
	return out, resp.StatusCode
}

func revokeAllOthersViaJWT(t *testing.T, app *TestApp, accessToken string, body any) int {
	t.Helper()
	resp, err := app.HTTPClient.Request(&e2etesting.RequestOptions{
		Method: "POST",
		Path:   "/api/v1/sessions/revoke-all-others",
		Body:   body,
		Headers: map[string]string{
			"Authorization": "Bearer " + accessToken,
		},
	})
	require.NoError(t, err)
	return resp.StatusCode
}

func TestSessionsListMarksCallerCurrentViaJTI(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "GET", "/api/v1/sessions", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
	login1 := apiLogin(t, app, "sescurr1", "sescurr1@example.com", "password123")

	resp2, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: "sescurr1", Password: "password123",
	})
	require.NoError(t, err)
	var login2 response.Response[auth.AuthLoginData]
	require.NoError(t, resp2.GetJSON(&login2))

	listFrom1, status1 := listSessionsViaJWT(t, app, login1.Data.AccessToken)
	require.Equal(t, 200, status1)
	listFrom2, status2 := listSessionsViaJWT(t, app, login2.Data.AccessToken)
	require.Equal(t, 200, status2)

	currentFrom1 := currentSessionID(t, listFrom1.Data.Sessions)
	currentFrom2 := currentSessionID(t, listFrom2.Data.Sessions)

	require.NotZero(t, currentFrom1, "list via login1 should mark exactly one session current")
	require.NotZero(t, currentFrom2, "list via login2 should mark exactly one session current")
	assert.NotEqual(t, currentFrom1, currentFrom2,
		"current row must differ between callers; access JTI should drive identification, not be a constant per user")
}

func TestSessionsRevokeAllOthersIsIdempotent(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/sessions/revoke-all-others", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)
	login1 := apiLogin(t, app, "sesidem1", "sesidem1@example.com", "password123")
	resp2, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: "sesidem1", Password: "password123",
	})
	require.NoError(t, err)
	var login2 response.Response[auth.AuthLoginData]
	require.NoError(t, resp2.GetJSON(&login2))

	require.Equal(t, 200, revokeAllOthersViaJWT(t, app, login2.Data.AccessToken, session.RevokeAllOtherSessionsRequest{}),
		"first revoke should succeed and remove login1's session")
	require.Equal(t, 200, revokeAllOthersViaJWT(t, app, login2.Data.AccessToken, session.RevokeAllOtherSessionsRequest{}),
		"second revoke must be a no-op, not 400 — caller's session is the only one left")

	_, status1 := apiRefresh(t, app, login1.Data.RefreshToken)
	assert.Equal(t, 401, status1, "login1 refresh stays revoked across repeated calls")
	assert.Equal(t, 200, apiGetProfile(t, app, login2.Data.AccessToken), "caller still authenticated")
}

func TestSessionsRevokeAllOthersDoesNotAffectOtherUsers(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/sessions/revoke-all-others", e2etesting.CategoryAuthorization, e2etesting.ValueHigh)

	loginA1 := apiLogin(t, app, "sesxuserA", "sesxuserA@example.com", "password123")
	respA2, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: "sesxuserA", Password: "password123",
	})
	require.NoError(t, err)
	var loginA2 response.Response[auth.AuthLoginData]
	require.NoError(t, respA2.GetJSON(&loginA2))

	loginB1 := apiLogin(t, app, "sesxuserB", "sesxuserB@example.com", "password123")
	respB2, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: "sesxuserB", Password: "password123",
	})
	require.NoError(t, err)
	var loginB2 response.Response[auth.AuthLoginData]
	require.NoError(t, respB2.GetJSON(&loginB2))

	require.Equal(t, 200, revokeAllOthersViaJWT(t, app, loginA2.Data.AccessToken, session.RevokeAllOtherSessionsRequest{}))

	_, statusA1 := apiRefresh(t, app, loginA1.Data.RefreshToken)
	assert.Equal(t, 401, statusA1, "user A's other session refresh should be revoked")
	assert.Equal(t, 401, apiGetProfile(t, app, loginA1.Data.AccessToken),
		"user A's other session access token should be revoked")

	_, statusB1 := apiRefresh(t, app, loginB1.Data.RefreshToken)
	assert.Equal(t, 200, statusB1, "user B's first session must be untouched by user A's revoke")
	_, statusB2 := apiRefresh(t, app, loginB2.Data.RefreshToken)
	assert.Equal(t, 200, statusB2, "user B's second session must be untouched by user A's revoke")
	assert.Equal(t, 200, apiGetProfile(t, app, loginB1.Data.AccessToken),
		"user B's first access token must still authenticate")
	assert.Equal(t, 200, apiGetProfile(t, app, loginB2.Data.AccessToken),
		"user B's second access token must still authenticate")
}

func TestSessionsRevokeAllOthersKillsExactlyNMinus1(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/sessions/revoke-all-others", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	const username = "sescount1"
	const password = "password123"
	app.AuthHelper.CreateTestUser(t, &e2etesting.TestUser{
		Username: username,
		Email:    "sescount1@example.com",
		Password: password,
	})

	const N = 4
	logins := make([]response.Response[auth.AuthLoginData], N)
	for i := 0; i < N; i++ {
		resp, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
			Username: username, Password: password,
		})
		require.NoError(t, err)
		require.NoError(t, resp.GetJSON(&logins[i]))
	}

	caller := logins[2]
	require.Equal(t, 200, revokeAllOthersViaJWT(t, app, caller.Data.AccessToken, session.RevokeAllOtherSessionsRequest{}))

	for i, l := range logins {
		want := 401
		why := "non-caller session should be revoked"
		if i == 2 {
			want = 200
			why = "caller's session should be preserved"
		}
		_, refreshStatus := apiRefresh(t, app, l.Data.RefreshToken)
		assert.Equal(t, want, refreshStatus, "session %d refresh: %s", i, why)
		assert.Equal(t, want, apiGetProfile(t, app, l.Data.AccessToken),
			"session %d access: %s", i, why)
	}
}

func TestSessionsRevokeAllOthersSurvivesRotation(t *testing.T) {
	t.Parallel()
	app := SetupTestApp(t)

	TagTest(t, "POST", "/api/v1/auth/refresh", e2etesting.CategoryHappyPath, e2etesting.ValueHigh)

	loginA := apiLogin(t, app, "sesrot1", "sesrot1@example.com", "password123")
	respB, err := app.HTTPClient.Post("/api/v1/auth/login", auth.AuthLoginRequest{
		Username: "sesrot1", Password: "password123",
	})
	require.NoError(t, err)
	var loginB response.Response[auth.AuthLoginData]
	require.NoError(t, respB.GetJSON(&loginB))

	require.Equal(t, 200, revokeAllOthersViaJWT(t, app, loginB.Data.AccessToken, session.RevokeAllOtherSessionsRequest{}))

	_, statusA := apiRefresh(t, app, loginA.Data.RefreshToken)
	require.Equal(t, 401, statusA)

	rotated, status := apiRefresh(t, app, loginB.Data.RefreshToken)
	require.Equal(t, 200, status, "surviving session must be able to rotate normally")
	require.NotEmpty(t, rotated.Data.AccessToken)
	require.NotEqual(t, loginB.Data.AccessToken, rotated.Data.AccessToken, "rotation must mint a new access token")

	listed, listStatus := listSessionsViaJWT(t, app, rotated.Data.AccessToken)
	require.Equal(t, 200, listStatus)
	assert.Equal(t, 1, countCurrent(listed.Data.Sessions),
		"after rotation, the surviving row's access_token_jti must be updated to the new JTI so the new access token still identifies it as current")

	require.Equal(t, 200, revokeAllOthersViaJWT(t, app, rotated.Data.AccessToken, session.RevokeAllOtherSessionsRequest{}),
		"second revoke-all-others using the rotated token must still find a matching session row, not 400 invalid_session")
}

func currentSessionID(t *testing.T, items []session.SessionItem) uint {
	t.Helper()
	var found uint
	var count int
	for _, s := range items {
		if s.Current {
			count++
			found = s.ID
		}
	}
	require.Equal(t, 1, count, "expected exactly one session marked current; got %d", count)
	return found
}

func countCurrent(items []session.SessionItem) int {
	var n int
	for _, s := range items {
		if s.Current {
			n++
		}
	}
	return n
}
