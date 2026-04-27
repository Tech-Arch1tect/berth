package app

import (
	"berth/internal/pkg/config"
)

func LoadConfig() (*config.Config, error) {
	var cfg config.Config
	if err := config.LoadConfig(&cfg); err != nil {
		return nil, err
	}

	if cfg.Custom.EncryptionSecret == "" {
		panic("CUSTOM_ENCRYPTION_SECRET is required but not set. Please set this environment variable with a secure secret key (minimum 32 characters). You can generate one with: openssl rand -base64 32")
	}

	if len(cfg.Custom.EncryptionSecret) < 16 {
		panic("CUSTOM_ENCRYPTION_SECRET must be at least 16 characters long for security. Please use a longer secret key. You can generate one with: openssl rand -base64 32")
	}

	return &cfg, nil
}
