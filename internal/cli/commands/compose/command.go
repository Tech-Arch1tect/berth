package compose

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var setCommandCmd = &cobra.Command{
	Use:   "set-command <server-id> <stack-name> <service> -- <command...>",
	Short: "Set the command for a service",
	Long: `Set the command for a service in a Docker Compose stack.

Use -- to separate the command arguments. All flags must come BEFORE --.

Examples:
  # Set command
  berth-cli compose set-command 1 my-stack app -- npm run start

  # Set command with multiple arguments
  berth-cli compose set-command 1 my-stack app -- /bin/sh -c "echo hello"

  # Skip confirmation (flags before positional args)
  berth-cli compose set-command --yes 1 my-stack app -- python app.py`,
	Args: cobra.MinimumNArgs(3),
	RunE: runSetCommand,
}

var setEntrypointCmd = &cobra.Command{
	Use:   "set-entrypoint <server-id> <stack-name> <service> -- <entrypoint...>",
	Short: "Set the entrypoint for a service",
	Long: `Set the entrypoint for a service in a Docker Compose stack.

Use -- to separate the entrypoint arguments. All flags must come BEFORE --.

Examples:
  # Set entrypoint
  berth-cli compose set-entrypoint 1 my-stack app -- /docker-entrypoint.sh

  # Set entrypoint with arguments
  berth-cli compose set-entrypoint 1 my-stack app -- /bin/sh -c

  # Skip confirmation (flags before positional args)
  berth-cli compose set-entrypoint --yes 1 my-stack app -- /entrypoint.sh`,
	Args: cobra.MinimumNArgs(3),
	RunE: runSetEntrypoint,
}

func init() {
	ComposeCmd.AddCommand(setCommandCmd)
	ComposeCmd.AddCommand(setEntrypointCmd)
	setCommandCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	setEntrypointCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func runSetCommand(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	var command []string
	if len(args) > 3 {
		command = args[3:]
	}

	if len(command) == 0 {
		printError("command cannot be empty. Use -- to separate command arguments")
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"command": map[string]any{
					"values": command,
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

	fmt.Printf("Successfully set command for service '%s'\n", serviceName)
	return nil
}

func runSetEntrypoint(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	var entrypoint []string
	if len(args) > 3 {
		entrypoint = args[3:]
	}

	if len(entrypoint) == 0 {
		printError("entrypoint cannot be empty. Use -- to separate entrypoint arguments")
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"entrypoint": map[string]any{
					"values": entrypoint,
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

	fmt.Printf("Successfully set entrypoint for service '%s'\n", serviceName)
	return nil
}
