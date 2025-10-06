package commands

import (
	"github.com/spf13/cobra"
)

var (
	apiKey    string
	serverURL string
)

var rootCmd = &cobra.Command{
	Use:   "berth-cli",
	Short: "Berth CLI - Manage Docker stacks remotely",
	Long: `A command-line interface for managing Docker stacks through the Berth platform.

Authenticate using API keys to interact with your Berth server via WebSocket.`,
	SilenceUsage:  true,
	SilenceErrors: true,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringVar(&apiKey, "api-key", "", "Berth API key (or set BERTH_API_KEY)")
	rootCmd.PersistentFlags().StringVar(&serverURL, "server", "", "Berth server URL (or set BERTH_SERVER_URL)")
}

func GetAPIKey() string {
	return apiKey
}

func GetServerURL() string {
	return serverURL
}
