package main

import (
	"github.com/tech-arch1tect/brx/config"
)

type BerthConfig struct {
	config.Config
	Custom AppCustomConfig `envPrefix:""`
}

type AppCustomConfig struct {
	EncryptionSecret string `env:"ENCRYPTION_SECRET"`
}
