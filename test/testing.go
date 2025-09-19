package test

import (
	"berth/internal/app"
	configEnforcement "berth/internal/config"
	"berth/models"
	"crypto/tls"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tech-arch1tect/brx"
	"github.com/tech-arch1tect/brx/services/auth"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func getRandomPort() int {
	return rand.Intn(57000) + 8000
}

type TestApp struct {
	app              *brx.App
	config           *app.BerthConfig
	db               *gorm.DB
	t                *testing.T
	baseURL          string
	client           *http.Client
	noRedirectClient *http.Client
}

type TestOptions struct {
	DatabaseDriver   string
	DatabaseDSN      string
	SessionMaxAge    time.Duration
	RememberMeExpiry time.Duration
	LogLevel         string
	ExtraFxOptions   []fx.Option
	EnvVars          map[string]string
}

func NewTestApp(t *testing.T, opts *TestOptions) *TestApp {
	if opts == nil {
		opts = &TestOptions{}
	}

	if opts.DatabaseDriver == "" {
		opts.DatabaseDriver = "sqlite"
	}
	if opts.DatabaseDSN == "" {
		tmpDir := os.TempDir()
		dbFile := fmt.Sprintf("%s/test_db_%d_%d.sqlite", tmpDir, time.Now().UnixNano(), getRandomPort())
		opts.DatabaseDSN = dbFile
	}
	if opts.SessionMaxAge == 0 {
		opts.SessionMaxAge = 5 * time.Minute
	}
	if opts.RememberMeExpiry == 0 {
		opts.RememberMeExpiry = 1 * time.Hour
	}
	if opts.LogLevel == "" {
		opts.LogLevel = "error"
	}

	testPort := getRandomPort()
	originalEnvVars := make(map[string]string)
	testEnvVars := map[string]string{
		"ENCRYPTION_SECRET":        "test-encryption-secret-32-chars-minimum",
		"JWT_SECRET_KEY":           "test-jwt-secret-key-32-chars-minimum-for-security",
		"DATABASE_DRIVER":          opts.DatabaseDriver,
		"DATABASE_DSN":             opts.DatabaseDSN,
		"SESSION_MAX_AGE":          opts.SessionMaxAge.String(),
		"AUTH_REMEMBER_ME_EXPIRY":  opts.RememberMeExpiry.String(),
		"LOG_LEVEL":                opts.LogLevel,
		"TOTP_ENABLED":             "true",
		"TOTP_ISSUER":              "Berth Test",
		"AUTH_REMEMBER_ME_ENABLED": "true",
		"MAIL_FROM_ADDRESS":        "test@berth.local",
		"MAIL_HOST":                "localhost",
		"MAIL_PORT":                "1025",
		"MAIL_ENCRYPTION":          "none",
		"MAIL_TEMPLATES_DIR":       "templates/mail",
		"SERVER_PORT":              fmt.Sprintf("%d", testPort),
		"SESSION_ENABLED":          "true",
		"CSRF_ENABLED":             "false",
	}

	if opts.EnvVars != nil {
		for k, v := range opts.EnvVars {
			testEnvVars[k] = v
		}
	}
	for k, v := range testEnvVars {
		originalEnvVars[k] = os.Getenv(k)
		os.Setenv(k, v)
	}

	cleanup := func() {
		for k, originalValue := range originalEnvVars {
			if originalValue == "" {
				os.Unsetenv(k)
			} else {
				os.Setenv(k, originalValue)
			}
		}
	}

	configEnforcement.EnforceRequiredSettings()

	os.Setenv("CSRF_ENABLED", "false")
	os.Setenv("SESSION_SECURE", "false")
	os.Setenv("SESSION_SAME_SITE", "lax")

	cfg, err := app.LoadConfig()
	require.NoError(t, err, "Failed to load test configuration")
	cfg.Database.Driver = opts.DatabaseDriver
	cfg.Database.DSN = opts.DatabaseDSN
	cfg.Session.MaxAge = opts.SessionMaxAge
	cfg.Session.Enabled = true
	cfg.Auth.RememberMeExpiry = opts.RememberMeExpiry
	cfg.Log.Level = opts.LogLevel
	cfg.TOTP.Enabled = true
	cfg.TOTP.Issuer = "Berth Test"
	cfg.Auth.RememberMeEnabled = true
	cfg.Inertia.Enabled = true

	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: jar,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Timeout: 30 * time.Second,
	}

	noRedirectClient := &http.Client{
		Jar: jar,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	testApp := &TestApp{
		config:           cfg,
		t:                t,
		baseURL:          fmt.Sprintf("https://localhost:%d", testPort),
		client:           client,
		noRedirectClient: noRedirectClient,
	}

	appOptions := &app.AppOptions{
		Config:         cfg,
		ExtraFxOptions: opts.ExtraFxOptions,
	}

	testApp.app = app.NewApp(appOptions)

	go func() {
		defer cleanup()
		if err := testApp.app.StartTest(); err != nil {
			t.Errorf("Test app startup failed: %v", err)
		}
	}()

	time.Sleep(1 * time.Second)
	testApp.db = testApp.app.DB()
	require.NotNil(t, testApp.db, "Database should be available after app startup")

	testApp.waitForDatabaseReady()
	testApp.waitForHTTPServerReady()
	return testApp
}

func (ta *TestApp) Cleanup() {
	if ta.app != nil {
		ta.app.StopTest()
	}

	if strings.Contains(ta.config.Database.DSN, "test_db_") {
		os.Remove(ta.config.Database.DSN)
	}
}

func (ta *TestApp) App() *brx.App {
	return ta.app
}

func (ta *TestApp) DB() *gorm.DB {
	return ta.db
}

func (ta *TestApp) Config() *app.BerthConfig {
	return ta.config
}

func (ta *TestApp) CreateTestUser(username, email, password string) (*models.User, error) {
	authSvc := auth.NewService(&ta.config.Config, ta.db, nil)

	hashedPassword, err := authSvc.HashPassword(password)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Username: username,
		Email:    email,
		Password: hashedPassword,
	}

	err = ta.db.Create(user).Error
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (ta *TestApp) Post(path string, data url.Values) (*http.Response, error) {
	req, err := http.NewRequest("POST", ta.baseURL+path, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return ta.client.Do(req)
}

func (ta *TestApp) PostNoRedirect(path string, data url.Values) (*http.Response, error) {
	req, err := http.NewRequest("POST", ta.baseURL+path, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return ta.noRedirectClient.Do(req)
}

func (ta *TestApp) Get(path string) (*http.Response, error) {
	req, err := http.NewRequest("GET", ta.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	return ta.client.Do(req)
}

func (ta *TestApp) NewHTTPClient() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{
		Jar: jar,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Timeout: 30 * time.Second,
	}
}

func (ta *TestApp) PostWithNewClient(path string, data url.Values) (*http.Response, error) {
	client := ta.NewHTTPClient()
	req, err := http.NewRequest("POST", ta.baseURL+path, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return client.Do(req)
}

func (ta *TestApp) GetWithNewClient(path string) (*http.Response, error) {
	client := ta.NewHTTPClient()
	req, err := http.NewRequest("GET", ta.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	return client.Do(req)
}

func (ta *TestApp) ReadBody(resp *http.Response) (string, error) {
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (ta *TestApp) waitForDatabaseReady() {
	maxAttempts := 30
	for i := 0; i < maxAttempts; i++ {
		if ta.isDatabaseReady() {
			ta.t.Logf("Database became ready after %d attempts", i+1)
			return
		}
		ta.t.Logf("Database not ready, attempt %d/%d", i+1, maxAttempts)
		time.Sleep(100 * time.Millisecond)
	}
	ta.t.Fatal("Database failed to become ready after 3 seconds")
}

func (ta *TestApp) isDatabaseReady() bool {
	var count int64

	requiredTables := []string{
		"users", "user_sessions", "roles", "permissions", "servers",
		"server_role_stack_permissions", "operation_logs", "operation_log_messages",
		"seed_trackers", "totp_secrets", "used_codes", "password_reset_tokens",
		"email_verification_tokens", "remember_me_tokens", "revoked_tokens", "refresh_tokens",
	}

	for _, table := range requiredTables {
		if err := ta.db.Table(table).Count(&count).Error; err != nil {
			ta.t.Logf("%s table not ready: %v", table, err)
			return false
		}
	}

	ta.t.Logf("Database tables are ready (all %d tables exist)", len(requiredTables))
	return true
}

func (ta *TestApp) waitForHTTPServerReady() {
	maxAttempts := 30
	for i := 0; i < maxAttempts; i++ {
		if ta.isHTTPServerReady() {
			ta.t.Logf("HTTP server became ready after %d attempts", i+1)
			return
		}
		ta.t.Logf("HTTP server not ready, attempt %d/%d", i+1, maxAttempts)
		time.Sleep(100 * time.Millisecond)
	}
	ta.t.Fatal("HTTP server failed to become ready after 3 seconds")
}

func (ta *TestApp) isHTTPServerReady() bool {
	resp, err := ta.Get("/auth/login")
	if err != nil {
		ta.t.Logf("HTTP server check failed: %v", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		ta.t.Logf("HTTP server returned status %d, expected 200", resp.StatusCode)
		return false
	}

	ta.t.Logf("HTTP server is ready and responding")
	return true
}
