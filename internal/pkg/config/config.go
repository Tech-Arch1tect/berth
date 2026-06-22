package config

import (
	"errors"
	"log"
	"strings"
	"time"

	"github.com/caarlos0/env/v10"
	"github.com/joho/godotenv"
)

type Config struct {
	App          AppConfig          `envPrefix:"APP_"`
	Server       ServerConfig       `envPrefix:"SERVER_"`
	Log          LogConfig          `envPrefix:"LOG_"`
	Frontend     FrontendConfig     `envPrefix:"FRONTEND_"`
	Database     DatabaseConfig     `envPrefix:"DATABASE_"`
	Auth         AuthConfig         `envPrefix:"AUTH_"`
	JWT          JWTConfig          `envPrefix:"JWT_"`
	RefreshToken RefreshTokenConfig `envPrefix:"REFRESH_TOKEN_"`
	TOTP         TOTPConfig         `envPrefix:"TOTP_"`
	RateLimit    RateLimitConfig    `envPrefix:"RATE_LIMIT_"`
	Mail         MailConfig         `envPrefix:"MAIL_"`
	Revocation   RevocationConfig   `envPrefix:"JWT_REVOCATION_"`
	Retention    RetentionConfig    `envPrefix:"RETENTION_"`
	Custom       AppCustomConfig    `envPrefix:""`
}

type RetentionConfig struct {
	Interval         time.Duration `env:"INTERVAL" envDefault:"6h"`
	AuditLogDays     int           `env:"AUDIT_LOG_DAYS" envDefault:"365"`
	OperationLogDays int           `env:"OPERATION_LOG_DAYS" envDefault:"365"`
}

type AppConfig struct {
	Name string `env:"NAME" envDefault:"berth"`
	URL  string `env:"URL" envDefault:"http://localhost:8080"`
}

type ServerConfig struct {
	Port           string   `env:"PORT" envDefault:"8080"`
	Host           string   `env:"HOST" envDefault:"localhost"`
	TrustedProxies []string `env:"TRUSTED_PROXIES" envSeparator:","`
}

type LogConfig struct {
	Level  string `env:"LEVEL" envDefault:"info"`
	Format string `env:"FORMAT" envDefault:"json"`
	Output string `env:"OUTPUT" envDefault:"stdout"`
}

type FrontendConfig struct {
	RootView    string `env:"ROOT_VIEW" envDefault:"app.html"`
	Development bool   `env:"DEVELOPMENT" envDefault:"false"`
	ViteDevURL  string `env:"VITE_DEV_URL" envDefault:"http://localhost:5173"`
}

type DatabaseConfig struct {
	Driver      string `env:"DRIVER" envDefault:"sqlite"`
	DSN         string `env:"DSN" envDefault:"app.db"`
	AutoMigrate bool   `env:"AUTO_MIGRATE" envDefault:"true"`
}

type AuthConfig struct {
	MinLength                    int           `env:"MIN_LENGTH" envDefault:"8"`
	RequireUpper                 bool          `env:"REQUIRE_UPPER" envDefault:"true"`
	RequireLower                 bool          `env:"REQUIRE_LOWER" envDefault:"true"`
	RequireNumber                bool          `env:"REQUIRE_NUMBER" envDefault:"true"`
	RequireSpecial               bool          `env:"REQUIRE_SPECIAL" envDefault:"false"`
	BcryptCost                   int           `env:"BCRYPT_COST" envDefault:"10"`
	PasswordResetEnabled         bool          `env:"PASSWORD_RESET_ENABLED" envDefault:"true"`
	PasswordResetTokenLength     int           `env:"PASSWORD_RESET_TOKEN_LENGTH" envDefault:"32"`
	PasswordResetExpiry          time.Duration `env:"PASSWORD_RESET_EXPIRY" envDefault:"1h"`
	EmailVerificationEnabled     bool          `env:"EMAIL_VERIFICATION_ENABLED" envDefault:"false"`
	EmailVerificationTokenLength int           `env:"EMAIL_VERIFICATION_TOKEN_LENGTH" envDefault:"32"`
	EmailVerificationExpiry      time.Duration `env:"EMAIL_VERIFICATION_EXPIRY" envDefault:"24h"`
}

type JWTConfig struct {
	SecretKey    string        `env:"SECRET_KEY"`
	AccessExpiry time.Duration `env:"ACCESS_EXPIRY" envDefault:"15m"`
	Issuer       string        `env:"ISSUER" envDefault:"berth"`
	Algorithm    string        `env:"ALGORITHM" envDefault:"HS256"`
}

type RefreshTokenConfig struct {
	TokenLength     int           `env:"TOKEN_LENGTH" envDefault:"32"`
	Expiry          time.Duration `env:"EXPIRY" envDefault:"720h"`
	CleanupInterval time.Duration `env:"CLEANUP_INTERVAL" envDefault:"1h"`
}

type TOTPConfig struct {
	Enabled bool   `env:"ENABLED" envDefault:"false"`
	Issuer  string `env:"ISSUER" envDefault:"berth"`
}

type RateLimitConfig struct {
	Enabled bool `env:"ENABLED" envDefault:"true"`
}

type MailConfig struct {
	Host         string `env:"HOST" envDefault:"localhost"`
	Port         int    `env:"PORT" envDefault:"587"`
	Username     string `env:"USERNAME"`
	Password     string `env:"PASSWORD"`
	Encryption   string `env:"ENCRYPTION" envDefault:"tls"`
	FromAddress  string `env:"FROM_ADDRESS"`
	FromName     string `env:"FROM_NAME"`
	TemplatesDir string `env:"TEMPLATES_DIR" envDefault:"templates/mail"`
}

type RevocationConfig struct {
	Enabled       bool          `env:"ENABLED" envDefault:"true"`
	Store         string        `env:"STORE" envDefault:"memory"`
	CleanupPeriod time.Duration `env:"CLEANUP_PERIOD" envDefault:"1h"`
}

type AppCustomConfig struct {
	EncryptionSecret                   string `env:"ENCRYPTION_SECRET"`
	LogDir                             string `env:"LOG_DIR" envDefault:"./storage/logs"`
	OperationLogLogToFile              bool   `env:"OPERATION_LOG_LOG_TO_FILE" envDefault:"false"`
	SecurityAuditLogLogToFile          bool   `env:"SECURITY_AUDIT_LOG_TO_FILE" envDefault:"false"`
	LogFileSizeLimitMB                 int    `env:"LOG_FILE_SIZE_LIMIT_MB" envDefault:"100"`
	OperationTimeoutSeconds            int    `env:"OPERATION_TIMEOUT_SECONDS" envDefault:"600"`
	AgentReadTimeoutSeconds            int    `env:"AGENT_READ_TIMEOUT_SECONDS" envDefault:"10"`
	ImageUpdateCheckEnabled            bool   `env:"IMAGE_UPDATE_CHECK_ENABLED" envDefault:"true"`
	ImageUpdateCheckInterval           string `env:"IMAGE_UPDATE_CHECK_INTERVAL" envDefault:"6h"`
	ImageUpdateCheckDisabledRegistries string `env:"IMAGE_UPDATE_CHECK_DISABLED_REGISTRIES" envDefault:""`
	OpenAPIEnabled                     bool   `env:"OPENAPI_ENABLED" envDefault:"true"`
	E2EMode                            bool   `env:"E2E_MODE" envDefault:"false"`
}

func LoadConfig(cfg any) error {
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found: %v", err)
	}

	if err := env.Parse(cfg); err != nil {
		return err
	}

	if config, ok := cfg.(*Config); ok {
		if err := validateJWTConfig(&config.JWT); err != nil {
			return err
		}
		if err := validateRefreshTokenConfig(&config.RefreshToken); err != nil {
			return err
		}
	}

	return nil
}

func validateJWTConfig(jwt *JWTConfig) error {
	if len(jwt.SecretKey) < 32 {
		return errors.New("JWT secret key must be at least 32 characters long")
	}

	lowerSecret := strings.ToLower(jwt.SecretKey)
	weakPatterns := []string{"password", "secret", "change", "test", "example", "default"}
	for _, pattern := range weakPatterns {
		if strings.Contains(lowerSecret, pattern) {
			return errors.New("JWT secret key contains weak patterns - please use a strong, random key")
		}
	}

	return nil
}

func validateRefreshTokenConfig(rt *RefreshTokenConfig) error {
	if rt.TokenLength < 16 {
		return errors.New("refresh token length must be at least 16 bytes")
	}

	if rt.TokenLength > 128 {
		return errors.New("refresh token length cannot exceed 128 bytes")
	}

	return nil
}
