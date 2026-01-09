package compose

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var setLabelCmd = &cobra.Command{
	Use:   "set-label <server-id> <stack-name> <service> <key=value>",
	Short: "Set a label for a service",
	Long: `Set or update a label for a service in a Docker Compose stack.

Examples:
  # Set a label
  berth-cli compose set-label 1 my-stack nginx app.version=1.2.3

  # Set deployment metadata
  berth-cli compose set-label 1 my-stack nginx deploy.commit=abc123 --yes`,
	Args: cobra.ExactArgs(4),
	RunE: runSetLabel,
}

var unsetLabelCmd = &cobra.Command{
	Use:   "unset-label <server-id> <stack-name> <service> <key>",
	Short: "Remove a label from a service",
	Long: `Remove a label from a service in a Docker Compose stack.

Examples:
  # Remove a label
  berth-cli compose unset-label 1 my-stack nginx deprecated

  # Remove with confirmation skip
  berth-cli compose unset-label 1 my-stack nginx old-label --yes`,
	Args: cobra.ExactArgs(4),
	RunE: runUnsetLabel,
}

func init() {
	ComposeCmd.AddCommand(setLabelCmd)
	ComposeCmd.AddCommand(unsetLabelCmd)
	setLabelCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	unsetLabelCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func runSetLabel(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	keyValue := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	parts := strings.SplitN(keyValue, "=", 2)
	if len(parts) != 2 {
		printError("invalid format: expected key=value, got '%s'", keyValue)
		os.Exit(1)
	}
	key, value := parts[0], parts[1]

	if key == "" {
		printError("label key cannot be empty")
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"labels": map[string]any{
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

	fmt.Printf("Successfully set label '%s' for service '%s'\n", key, serviceName)
	return nil
}

func runUnsetLabel(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	key := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	if key == "" {
		printError("label key cannot be empty")
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"labels": map[string]any{
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

	fmt.Printf("Successfully removed label '%s' from service '%s'\n", key, serviceName)
	return nil
}
