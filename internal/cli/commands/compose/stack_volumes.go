package compose

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var createVolumeCmd = &cobra.Command{
	Use:   "create-volume <server-id> <stack-name> <volume-name>",
	Short: "Create a volume in a stack",
	Long: `Create a new volume definition in a Docker Compose stack.

The volume is created with default settings. Use flags to customize.

Examples:
  # Create a basic volume
  berth-cli compose create-volume 1 my-stack data

  # Create with custom driver
  berth-cli compose create-volume --driver local 1 my-stack logs

  # Create with driver options
  berth-cli compose create-volume --driver-opt type=nfs --driver-opt o=addr=10.0.0.1 1 my-stack shared

  # Create an external volume reference
  berth-cli compose create-volume --external 1 my-stack existing-vol

  # Skip confirmation
  berth-cli compose create-volume --yes 1 my-stack cache`,
	Args: cobra.ExactArgs(3),
	RunE: runCreateVolume,
}

var deleteVolumeCmd = &cobra.Command{
	Use:   "delete-volume <server-id> <stack-name> <volume-name>",
	Short: "Delete a volume from a stack",
	Long: `Delete a volume definition from a Docker Compose stack.

The volume must not be in use by any services.

Examples:
  # Delete a volume
  berth-cli compose delete-volume 1 my-stack old-volume

  # Skip confirmation
  berth-cli compose delete-volume --yes 1 my-stack unused-vol`,
	Args: cobra.ExactArgs(3),
	RunE: runDeleteVolume,
}

func init() {
	ComposeCmd.AddCommand(createVolumeCmd)
	ComposeCmd.AddCommand(deleteVolumeCmd)

	createVolumeCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	createVolumeCmd.Flags().String("driver", "", "Volume driver (e.g., local, nfs)")
	createVolumeCmd.Flags().StringArray("driver-opt", nil, "Driver options (can be specified multiple times: --driver-opt key=value)")
	createVolumeCmd.Flags().Bool("external", false, "Mark as external volume")

	deleteVolumeCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func volumeExists(config map[string]any, volumeName string) bool {
	volumes, ok := config["volumes"].(map[string]any)
	if !ok {
		return false
	}
	_, exists := volumes[volumeName]
	return exists
}

func getServicesUsingVolume(config map[string]any, volumeName string) []string {
	var using []string
	services, ok := config["services"].(map[string]any)
	if !ok {
		return using
	}

	for serviceName, svcRaw := range services {
		svc, ok := svcRaw.(map[string]any)
		if !ok {
			continue
		}
		volumes, ok := svc["volumes"].([]any)
		if !ok {
			continue
		}
		for _, v := range volumes {
			vol, ok := v.(map[string]any)
			if !ok {
				continue
			}
			if volType, _ := vol["type"].(string); volType == "volume" {
				if source, _ := vol["source"].(string); source == volumeName {
					using = append(using, serviceName)
					break
				}
			}
		}
	}
	return using
}

func parseDriverOpts(opts []string) (map[string]string, error) {
	if len(opts) == 0 {
		return nil, nil
	}
	result := make(map[string]string)
	for _, opt := range opts {
		parts := strings.SplitN(opt, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid driver option format: %s (expected key=value)", opt)
		}
		result[parts[0]] = parts[1]
	}
	return result, nil
}

func runCreateVolume(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	volumeName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")
	driver, _ := cmd.Flags().GetString("driver")
	driverOpts, _ := cmd.Flags().GetStringArray("driver-opt")
	external, _ := cmd.Flags().GetBool("external")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if volumeExists(config, volumeName) {
		printError("volume '%s' already exists in stack", volumeName)
		os.Exit(1)
	}

	volConfig := map[string]any{}
	if driver != "" {
		volConfig["driver"] = driver
	}
	if external {
		volConfig["external"] = true
	}

	if len(driverOpts) > 0 {
		opts, err := parseDriverOpts(driverOpts)
		if err != nil {
			printError("%v", err)
			os.Exit(1)
		}
		volConfig["driver_opts"] = opts
	}

	changes := map[string]any{
		"volume_changes": map[string]any{
			volumeName: volConfig,
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

	fmt.Printf("Successfully created volume '%s'\n", volumeName)
	return nil
}

func runDeleteVolume(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	volumeName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if !volumeExists(config, volumeName) {
		printError("volume '%s' not found in stack", volumeName)
		os.Exit(1)
	}

	using := getServicesUsingVolume(config, volumeName)
	if len(using) > 0 {
		printError("volume '%s' is in use by services: %v\nRemove volume mounts from services first.", volumeName, using)
		os.Exit(1)
	}

	changes := map[string]any{
		"volume_changes": map[string]any{
			volumeName: nil,
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

	fmt.Printf("Successfully deleted volume '%s'\n", volumeName)
	return nil
}
