package config

import (
	brxconfig "github.com/tech-arch1tect/brx/config"
)

type BerthConfig struct {
	brxconfig.Config
	Custom AppCustomConfig `envPrefix:""`
}

type AppCustomConfig struct {
	EncryptionSecret          string `env:"ENCRYPTION_SECRET"`
	LogDir                    string `env:"LOG_DIR" envDefault:"./storage/logs"`
	OperationLogLogToFile     bool   `env:"OPERATION_LOG_LOG_TO_FILE" envDefault:"false"`
	SecurityAuditLogLogToFile bool   `env:"SECURITY_AUDIT_LOG_TO_FILE" envDefault:"false"`
	OperationTimeoutSeconds   int    `env:"OPERATION_TIMEOUT_SECONDS" envDefault:"600"`
}
