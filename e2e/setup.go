package e2e

import (
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"berth/internal/app"
	"berth/internal/app/apptest"
	"berth/internal/pkg/crypto"

	e2etesting "berth/e2e/internal/harness"
	"berth/internal/domain/auth"
	"berth/internal/domain/server"
	"berth/internal/domain/user"
	"berth/internal/pkg/config"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var (
	globalCoverageTracker     *e2etesting.CoverageTracker
	globalCoverageTrackerOnce sync.Once
	routesRegisteredOnce      sync.Once
)

func GetGlobalCoverageTracker() *e2etesting.CoverageTracker {
	globalCoverageTrackerOnce.Do(func() {
		globalCoverageTracker = e2etesting.NewCoverageTracker()

		globalCoverageTracker.AddExcludePattern("static")
		globalCoverageTracker.AddExcludePattern("assets")
	})
	return globalCoverageTracker
}

func PrintCoverageReport() {
	if globalCoverageTracker != nil {
		globalCoverageTracker.PrintReport()
	}
}

func GetCoverageStats() e2etesting.CoverageStats {
	if globalCoverageTracker == nil {
		return e2etesting.CoverageStats{}
	}
	return globalCoverageTracker.GetStats()
}

func TagTest(t interface{ Name() string }, method, path, category, value string) {
	e2etesting.TagTest(t, method, path, category, value)
}

func GetTestQualityStats() e2etesting.TestQualityStats {
	return e2etesting.GetTestTagTracker().GetStats()
}

func PrintTestQualityReport() {
	e2etesting.GetTestTagTracker().PrintReport()
}

type TestApp struct {
	Config        *config.Config
	DB            *gorm.DB
	Echo          *echo.Echo
	BaseURL       string
	AuthSvc       *auth.Service
	Mail          *e2etesting.CapturingMailService
	HTTPClient    *e2etesting.HTTPClient
	AuthHelper    *e2etesting.AuthHelper
	SessionHelper *e2etesting.SessionHelper
}

func e2eConfigOverrides(cfg *config.Config) {
	cfg.Mail.TemplatesDir = filepath.Join("..", "testdata", "mail")
}

func SetupTestApp(t *testing.T) *TestApp {
	return SetupTestAppWithConfig(t)
}

func SetupTestAppWithConfig(t *testing.T, modifiers ...func(*config.Config)) *TestApp {
	options := []apptest.Option{apptest.WithConfig(e2eConfigOverrides)}
	for _, m := range modifiers {
		options = append(options, apptest.WithConfig(m))
	}

	options = append(options, apptest.WithBeforeRoutes(func(g *app.Graph) {
		tracker := GetGlobalCoverageTracker()
		g.Echo.Use(tracker.TrackingMiddleware())
		routesRegisteredOnce.Do(func() {
			tracker.RegisterRoutes(g.Echo)
		})
	}))

	booted := apptest.Boot(t, options...)

	baseURL := apptest.WaitForListener(t, booted.Echo, 5*time.Second)

	httpClient := &e2etesting.HTTPClient{
		Client:  apptest.NewTLSClient(),
		BaseURL: baseURL,
	}

	return &TestApp{
		Config:        booted.Config,
		DB:            booted.DB,
		Echo:          booted.Echo,
		BaseURL:       baseURL,
		AuthSvc:       booted.Graph.AuthSvc,
		Mail:          booted.Mail,
		HTTPClient:    httpClient,
		AuthHelper:    e2etesting.NewAuthHelper(httpClient, booted.DB, booted.Graph.AuthSvc),
		SessionHelper: e2etesting.NewSessionHelper(httpClient, booted.DB),
	}
}

func (a *TestApp) CreateVerifiedTestUser(t *testing.T) *e2etesting.TestUser {
	user := &e2etesting.TestUser{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	a.AuthHelper.CreateTestUser(t, user)

	err := a.DB.Table("users").
		Where("id = ?", user.ID).
		Update("email_verified_at", time.Now()).Error
	require.NoError(t, err, "failed to verify test user email")

	return user
}

func (a *TestApp) CreateTestServer(t *testing.T, name string, mockAgentURL string) *server.Server {
	crypto := crypto.NewCrypto("test-encryption-secret-key-32chars!!")
	encryptedToken, err := crypto.Encrypt("test-access-token")
	require.NoError(t, err, "failed to encrypt access tokene")

	encryptedBackupPassword, err := crypto.Encrypt("test-backup-password")
	require.NoError(t, err, "failed to encrypt backup password")

	host := mockAgentURL
	port := 443

	if strings.HasPrefix(mockAgentURL, "https://") {
		hostPort := strings.TrimPrefix(mockAgentURL, "https://")
		parts := strings.Split(hostPort, ":")
		if len(parts) == 2 {
			host = parts[0]
			if p, err := strconv.Atoi(parts[1]); err == nil {
				port = p
			}
		}
	}

	skipSSL := true
	srv := &server.Server{
		Name:                name,
		Host:                host,
		Port:                port,
		AccessToken:         encryptedToken,
		SkipSSLVerification: &skipSSL,
		IsActive:            true,
		BackupsEnabled:      true,
		BackupPassword:      encryptedBackupPassword,
	}

	err = a.DB.Create(srv).Error
	require.NoError(t, err, "failed to create test server")

	return srv
}

func (a *TestApp) CreateTestServerWithAgent(t *testing.T, name string) (*MockAgent, *server.Server) {
	mockAgent := NewMockAgent()
	t.Cleanup(mockAgent.Close)

	srv := a.CreateTestServer(t, name, mockAgent.URL)
	return mockAgent, srv
}

func (a *TestApp) CreateAdminTestUser(t *testing.T, u *e2etesting.TestUser) {
	a.AuthHelper.CreateTestUser(t, u)

	var adminRole user.Role
	err := a.DB.Where("name = ?", "admin").First(&adminRole).Error
	require.NoError(t, err, "failed to find admin role")

	err = a.DB.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", u.ID, adminRole.ID).Error
	require.NoError(t, err, "failed to assign admin role to user")
}
