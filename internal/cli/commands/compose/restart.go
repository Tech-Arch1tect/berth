package compose

import (
	"fmt"
	"os"
	"slices"

	"github.com/spf13/cobra"
)

var validRestartPolicies = []string{"no", "always", "on-failure", "unless-stopped"}

var setRestartCmd = &cobra.Command{
	Use:   "set-restart <server-id> <stack-name> <service> <policy>",
	Short: "Set the restart policy for a service",
	Long: `Set the restart policy for a service in a Docker Compose stack.

Valid policies: no, always, on-failure, unless-stopped

Examples:
  # Set restart policy to always
  berth-cli compose set-restart 1 my-stack nginx always

  # Set restart policy to on-failure
  berth-cli compose set-restart 1 my-stack nginx on-failure --yes`,
	Args: cobra.ExactArgs(4),
	RunE: runSetRestart,
}

func init() {
	ComposeCmd.AddCommand(setRestartCmd)
	setRestartCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func runSetRestart(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	policy := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	if !slices.Contains(validRestartPolicies, policy) {
		printError("invalid restart policy '%s'. Valid policies: %v", policy, validRestartPolicies)
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"restart": policy,
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

	fmt.Printf("Successfully set restart policy to '%s' for service '%s'\n", policy, serviceName)
	return nil
}
