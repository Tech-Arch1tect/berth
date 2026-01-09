package compose

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var setEnvCmd = &cobra.Command{
	Use:   "set-env <server-id> <stack-name> <service> <KEY=value>",
	Short: "Set an environment variable for a service",
	Long: `Set or update an environment variable for a service in a Docker Compose stack.

Examples:
  # Set an environment variable
  berth-cli compose set-env 1 my-stack nginx DATABASE_URL=postgres://localhost/db

  # Set with confirmation skip
  berth-cli compose set-env 1 my-stack nginx API_KEY=secret --yes`,
	Args: cobra.ExactArgs(4),
	RunE: runSetEnv,
}

var unsetEnvCmd = &cobra.Command{
	Use:   "unset-env <server-id> <stack-name> <service> <KEY>",
	Short: "Remove an environment variable from a service",
	Long: `Remove an environment variable from a service in a Docker Compose stack.

Examples:
  # Remove an environment variable
  berth-cli compose unset-env 1 my-stack nginx DEBUG

  # Remove with confirmation skip
  berth-cli compose unset-env 1 my-stack nginx DEBUG --yes`,
	Args: cobra.ExactArgs(4),
	RunE: runUnsetEnv,
}

func init() {
	ComposeCmd.AddCommand(setEnvCmd)
	ComposeCmd.AddCommand(unsetEnvCmd)
	setEnvCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	unsetEnvCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func runSetEnv(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	keyValue := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	parts := strings.SplitN(keyValue, "=", 2)
	if len(parts) != 2 {
		printError("invalid format: expected KEY=value, got '%s'", keyValue)
		os.Exit(1)
	}
	key, value := parts[0], parts[1]

	if key == "" {
		printError("environment variable key cannot be empty")
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"environment": map[string]any{
					key: value,
				},
			},
		},
	}

	result, err := updateComposeConfig(cmd, serverID, stackName, changes, true)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if result.OriginalYAML != "" && result.ModifiedYAML != "" {
		displayDiff(result.OriginalYAML, result.ModifiedYAML)
	}

	if !skipConfirm {
		if !confirmApply() {
			fmt.Println("Cancelled.")
			os.Exit(2)
		}
	}

	_, err = updateComposeConfig(cmd, serverID, stackName, changes, false)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	fmt.Printf("Successfully set environment variable '%s' for service '%s'\n", key, serviceName)
	return nil
}

func runUnsetEnv(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	key := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	if key == "" {
		printError("environment variable key cannot be empty")
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"environment": map[string]any{
					key: nil,
				},
			},
		},
	}

	result, err := updateComposeConfig(cmd, serverID, stackName, changes, true)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if result.OriginalYAML != "" && result.ModifiedYAML != "" {
		displayDiff(result.OriginalYAML, result.ModifiedYAML)
	}

	if !skipConfirm {
		if !confirmApply() {
			fmt.Println("Cancelled.")
			os.Exit(2)
		}
	}

	_, err = updateComposeConfig(cmd, serverID, stackName, changes, false)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	fmt.Printf("Successfully removed environment variable '%s' from service '%s'\n", key, serviceName)
	return nil
}
