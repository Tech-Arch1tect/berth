package compose

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var createConfigCmd = &cobra.Command{
	Use:   "create-config <server-id> <stack-name> <config-name>",
	Short: "Create a config in a stack",
	Long: `Create a new config definition in a Docker Compose stack.

Configs can be sourced from a file or environment variable.

Examples:
  # Create config from file
  berth-cli compose create-config --file ./configs/nginx.conf 1 my-stack nginx_config

  # Create config from environment variable
  berth-cli compose create-config --environment APP_CONFIG 1 my-stack app_config

  # Create an external config reference
  berth-cli compose create-config --external 1 my-stack existing-config

  # Skip confirmation
  berth-cli compose create-config --yes --file ./config.json 1 my-stack settings`,
	Args: cobra.ExactArgs(3),
	RunE: runCreateConfig,
}

var deleteConfigCmd = &cobra.Command{
	Use:   "delete-config <server-id> <stack-name> <config-name>",
	Short: "Delete a config from a stack",
	Long: `Delete a config definition from a Docker Compose stack.

Examples:
  # Delete a config
  berth-cli compose delete-config 1 my-stack old-config

  # Skip confirmation
  berth-cli compose delete-config --yes 1 my-stack unused-config`,
	Args: cobra.ExactArgs(3),
	RunE: runDeleteConfig,
}

func init() {
	ComposeCmd.AddCommand(createConfigCmd)
	ComposeCmd.AddCommand(deleteConfigCmd)

	createConfigCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	createConfigCmd.Flags().String("file", "", "Path to config file")
	createConfigCmd.Flags().String("environment", "", "Environment variable containing the config")
	createConfigCmd.Flags().Bool("external", false, "Mark as external config")

	deleteConfigCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func configExists(config map[string]any, configName string) bool {
	configs, ok := config["configs"].(map[string]any)
	if !ok {
		return false
	}
	_, exists := configs[configName]
	return exists
}

func runCreateConfig(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	configName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")
	file, _ := cmd.Flags().GetString("file")
	environment, _ := cmd.Flags().GetString("environment")
	external, _ := cmd.Flags().GetBool("external")

	if file == "" && environment == "" && !external {
		printError("must specify --file, --environment, or --external")
		os.Exit(1)
	}

	composeConfig, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if configExists(composeConfig, configName) {
		printError("config '%s' already exists in stack", configName)
		os.Exit(1)
	}

	cfgConfig := map[string]any{}
	if file != "" {
		cfgConfig["file"] = file
	}
	if environment != "" {
		cfgConfig["environment"] = environment
	}
	if external {
		cfgConfig["external"] = true
	}

	changes := map[string]any{
		"config_changes": map[string]any{
			configName: cfgConfig,
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

	fmt.Printf("Successfully created config '%s'\n", configName)
	return nil
}

func runDeleteConfig(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	configName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	composeConfig, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if !configExists(composeConfig, configName) {
		printError("config '%s' not found in stack", configName)
		os.Exit(1)
	}

	changes := map[string]any{
		"config_changes": map[string]any{
			configName: nil,
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

	fmt.Printf("Successfully deleted config '%s'\n", configName)
	return nil
}
