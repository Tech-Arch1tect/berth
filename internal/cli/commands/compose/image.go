package compose

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var setImageCmd = &cobra.Command{
	Use:   "set-image <server-id> <stack-name> <service> <image>",
	Short: "Set the image for a service",
	Long: `Update the container image for a service in a Docker Compose stack.

Examples:
  # Set image with preview and confirmation
  berth-cli compose set-image 1 my-stack nginx nginx:1.25

  # Skip confirmation and apply directly
  berth-cli compose set-image 1 my-stack nginx nginx:1.25 --yes`,
	Args: cobra.ExactArgs(4),
	RunE: runSetImage,
}

func init() {
	ComposeCmd.AddCommand(setImageCmd)
	setImageCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func runSetImage(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	image := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"image": image,
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

	result, err = updateComposeConfig(cmd, serverID, stackName, changes, false)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	fmt.Printf("Successfully updated image for service '%s' to '%s'\n", serviceName, image)
	return nil
}
