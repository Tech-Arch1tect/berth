package cli

import (
	"fmt"
	"os"
)

type Config struct {
	APIKey    string
	ServerURL string
}

func LoadConfig(apiKeyFlag, serverURLFlag string) (*Config, error) {
	config := &Config{
		APIKey:    apiKeyFlag,
		ServerURL: serverURLFlag,
	}

	if config.APIKey == "" {
		config.APIKey = os.Getenv("BERTH_API_KEY")
	}

	if config.ServerURL == "" {
		config.ServerURL = os.Getenv("BERTH_SERVER_URL")
	}

	if config.APIKey == "" {
		return nil, fmt.Errorf("API key is required. Set --api-key flag or BERTH_API_KEY environment variable")
	}

	if config.ServerURL == "" {
		return nil, fmt.Errorf("Server URL is required. Set --server flag or BERTH_SERVER_URL environment variable")
	}

	return config, nil
}
