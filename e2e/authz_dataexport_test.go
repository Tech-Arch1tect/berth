package e2e

import (
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/pkg/response"

	e2etesting "berth/e2e/internal/harness"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthzDataExport_MigrationRoutesRequireAdminScope(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		url   string
		scope string
	}{
		{"export", "/api/v1/admin/migration/export", permnames.AdminSystemExport},
		{"import", "/api/v1/admin/migration/import", permnames.AdminSystemImport},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			app := SetupTestApp(t)

			admin := &e2etesting.TestUser{
				Username: "authz-" + tc.name + "-admin",
				Email:    "authz-" + tc.name + "-admin@example.com",
				Password: "password123",
			}
			app.CreateAdminTestUser(t, admin)
			adminClient := app.SessionHelper.SimulateLogin(t, app.AuthHelper, admin.Username, admin.Password)
			adminJWT := app.AuthHelper.JWTLogin(t, admin.Username, admin.Password)

			regular := &e2etesting.TestUser{
				Username: "authz-" + tc.name + "-user",
				Email:    "authz-" + tc.name + "-user@example.com",
				Password: "password123",
			}
			app.AuthHelper.CreateTestUser(t, regular)
			regularJWT := app.AuthHelper.JWTLogin(t, regular.Username, regular.Password)

			post := func(t *testing.T, bearer string) *e2etesting.Response {
				t.Helper()
				TagTest(t, "POST", tc.url, e2etesting.CategoryAuthorization, e2etesting.ValueHigh)
				opts := &e2etesting.RequestOptions{Method: "POST", Path: tc.url, Body: map[string]any{}}
				if bearer != "" {
					opts.Headers = map[string]string{"Authorization": "Bearer " + bearer}
				}
				resp, err := app.HTTPClient.Request(opts)
				require.NoError(t, err)
				return resp
			}

			createAdminKey := func(t *testing.T, name string) (uint, string) {
				t.Helper()
				createResp, err := adminClient.Post("/api/v1/api-keys", map[string]any{"name": name})
				require.NoError(t, err)
				var keyResult response.Response[apikey.CreateAPIKeyData]
				require.NoError(t, createResp.GetJSON(&keyResult))
				return keyResult.Data.APIKey.ID, keyResult.Data.PlainKey
			}

			t.Run("unauthenticated returns 401", func(t *testing.T) {
				assert.Equal(t, 401, post(t, "").StatusCode)
			})

			t.Run("non-admin JWT returns 403", func(t *testing.T) {
				assert.Equal(t, 403, post(t, regularJWT).StatusCode)
			})

			const admittedReachesValidation = 400

			t.Run("admin JWT is admitted", func(t *testing.T) {
				assert.Equal(t, admittedReachesValidation, post(t, adminJWT).StatusCode)
			})

			t.Run("admin API key without the admin scope returns 403", func(t *testing.T) {
				_, plainKey := createAdminKey(t, "authz-"+tc.name+"-noscope")
				assert.Equal(t, 403, post(t, plainKey).StatusCode)
			})

			t.Run("admin API key with the admin scope is admitted", func(t *testing.T) {
				keyID, plainKey := createAdminKey(t, "authz-"+tc.name+"-scoped")
				addScopeResp, err := adminClient.Post("/api/v1/api-keys/"+Itoa(keyID)+"/scopes", map[string]any{
					"stack_pattern": "*",
					"permission":    tc.scope,
				})
				require.NoError(t, err)
				require.Equal(t, 201, addScopeResp.StatusCode)

				assert.Equal(t, admittedReachesValidation, post(t, plainKey).StatusCode)
			})
		})
	}
}
