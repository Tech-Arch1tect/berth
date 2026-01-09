package compose

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var addNetworkCmd = &cobra.Command{
	Use:   "add-network <server-id> <stack-name> <service> <network-name>",
	Short: "Add a service to a network",
	Long: `Add a service to a network in a Docker Compose stack.

The network must already exist at the stack level.

Examples:
  # Add service to a network
  berth-cli compose add-network 1 my-stack nginx frontend

  # Skip confirmation
  berth-cli compose add-network --yes 1 my-stack nginx backend`,
	Args: cobra.ExactArgs(4),
	RunE: runAddNetwork,
}

var removeNetworkCmd = &cobra.Command{
	Use:   "remove-network <server-id> <stack-name> <service> <network-name>",
	Short: "Remove a service from a network",
	Long: `Remove a service from a network in a Docker Compose stack.

Examples:
  # Remove service from a network
  berth-cli compose remove-network 1 my-stack nginx frontend

  # Skip confirmation
  berth-cli compose remove-network --yes 1 my-stack nginx frontend`,
	Args: cobra.ExactArgs(4),
	RunE: runRemoveNetwork,
}

func init() {
	ComposeCmd.AddCommand(addNetworkCmd)
	ComposeCmd.AddCommand(removeNetworkCmd)
	addNetworkCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	removeNetworkCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func getStackNetworks(config map[string]any) map[string]any {
	networks, ok := config["networks"].(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return networks
}

func getCurrentNetworks(config map[string]any, serviceName string) (map[string]any, error) {
	services, ok := config["services"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("no services found")
	}

	service, ok := services[serviceName].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("service '%s' not found", serviceName)
	}

	networksRaw, ok := service["networks"]
	if !ok || networksRaw == nil {
		return map[string]any{}, nil
	}

	networks, ok := networksRaw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid networks format")
	}

	result := make(map[string]any)
	for name, cfg := range networks {
		if cfg == nil {
			result[name] = map[string]any{}
		} else {
			result[name] = cfg
		}
	}

	return result, nil
}

func runAddNetwork(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	networkName := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	stackNetworks := getStackNetworks(config)
	if _, exists := stackNetworks[networkName]; !exists {
		printError("network '%s' does not exist in stack. Define it first with 'compose create-network'", networkName)
		os.Exit(1)
	}

	currentNetworks, err := getCurrentNetworks(config, serviceName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if _, exists := currentNetworks[networkName]; exists {
		printError("service '%s' is already in network '%s'", serviceName, networkName)
		os.Exit(1)
	}

	currentNetworks[networkName] = map[string]any{}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"networks": currentNetworks,
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

	fmt.Printf("Successfully added service '%s' to network '%s'\n", serviceName, networkName)
	return nil
}

func runRemoveNetwork(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	networkName := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	currentNetworks, err := getCurrentNetworks(config, serviceName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if _, exists := currentNetworks[networkName]; !exists {
		printError("service '%s' is not in network '%s'", serviceName, networkName)
		os.Exit(1)
	}

	if len(currentNetworks) == 1 && networkName == "default" {
		printError("cannot remove service from 'default' network when it's the only network.\nDocker Compose requires services to be on at least one network.")
		os.Exit(1)
	}

	if len(currentNetworks) == 1 {
		fmt.Printf("Warning: Removing the last network from service '%s'.\n", serviceName)
		fmt.Println("Docker Compose will automatically add the service to the default network.")
	}

	delete(currentNetworks, networkName)

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"networks": currentNetworks,
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

	fmt.Printf("Successfully removed service '%s' from network '%s'\n", serviceName, networkName)
	return nil
}
