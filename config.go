package main

import (
	"github.com/tech-arch1tect/brx/config"
)

type StarterKitConfig struct {
	config.Config
	Custom AppCustomConfig `envPrefix:"CUSTOM_"`
}

type AppCustomConfig struct {
	EncryptionSecret string `env:"ENCRYPTION_SECRET"`
}
