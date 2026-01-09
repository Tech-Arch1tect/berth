package compose

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var createNetworkCmd = &cobra.Command{
	Use:   "create-network <server-id> <stack-name> <network-name>",
	Short: "Create a network in a stack",
	Long: `Create a new network definition in a Docker Compose stack.

The network is created with default settings. Use flags to customize.

Examples:
  # Create a basic network
  berth-cli compose create-network 1 my-stack frontend

  # Create with custom driver
  berth-cli compose create-network --driver overlay 1 my-stack backend

  # Create with IPAM configuration
  berth-cli compose create-network --subnet 172.28.0.0/16 --gateway 172.28.0.1 1 my-stack internal

  # Create an external network reference
  berth-cli compose create-network --external 1 my-stack shared-net

  # Skip confirmation
  berth-cli compose create-network --yes 1 my-stack internal`,
	Args: cobra.ExactArgs(3),
	RunE: runCreateNetwork,
}

var deleteNetworkCmd = &cobra.Command{
	Use:   "delete-network <server-id> <stack-name> <network-name>",
	Short: "Delete a network from a stack",
	Long: `Delete a network definition from a Docker Compose stack.

The network must not be in use by any services.

Examples:
  # Delete a network
  berth-cli compose delete-network 1 my-stack old-network

  # Skip confirmation
  berth-cli compose delete-network --yes 1 my-stack unused-net`,
	Args: cobra.ExactArgs(3),
	RunE: runDeleteNetwork,
}

func init() {
	ComposeCmd.AddCommand(createNetworkCmd)
	ComposeCmd.AddCommand(deleteNetworkCmd)

	createNetworkCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	createNetworkCmd.Flags().String("driver", "", "Network driver (e.g., bridge, overlay)")
	createNetworkCmd.Flags().Bool("external", false, "Mark as external network")
	createNetworkCmd.Flags().String("subnet", "", "Subnet in CIDR format (e.g., 172.28.0.0/16)")
	createNetworkCmd.Flags().String("gateway", "", "Gateway IP address")
	createNetworkCmd.Flags().String("ip-range", "", "IP range for allocation")
	createNetworkCmd.Flags().String("ipam-driver", "", "IPAM driver (default: default)")

	deleteNetworkCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func networkExists(config map[string]any, networkName string) bool {
	networks, ok := config["networks"].(map[string]any)
	if !ok {
		return false
	}
	_, exists := networks[networkName]
	return exists
}

func getServicesUsingNetwork(config map[string]any, networkName string) []string {
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
		networks, ok := svc["networks"].(map[string]any)
		if !ok {
			continue
		}
		if _, exists := networks[networkName]; exists {
			using = append(using, serviceName)
		}
	}
	return using
}

func runCreateNetwork(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	networkName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")
	driver, _ := cmd.Flags().GetString("driver")
	external, _ := cmd.Flags().GetBool("external")
	subnet, _ := cmd.Flags().GetString("subnet")
	gateway, _ := cmd.Flags().GetString("gateway")
	ipRange, _ := cmd.Flags().GetString("ip-range")
	ipamDriver, _ := cmd.Flags().GetString("ipam-driver")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if networkExists(config, networkName) {
		printError("network '%s' already exists in stack", networkName)
		os.Exit(1)
	}

	netConfig := map[string]any{}
	if driver != "" {
		netConfig["driver"] = driver
	}
	if external {
		netConfig["external"] = true
	}

	if subnet != "" || gateway != "" || ipRange != "" || ipamDriver != "" {
		ipamConfig := map[string]any{}
		if ipamDriver != "" {
			ipamConfig["driver"] = ipamDriver
		}
		if subnet != "" || gateway != "" || ipRange != "" {
			pool := map[string]any{}
			if subnet != "" {
				pool["subnet"] = subnet
			}
			if gateway != "" {
				pool["gateway"] = gateway
			}
			if ipRange != "" {
				pool["ip_range"] = ipRange
			}
			ipamConfig["config"] = []map[string]any{pool}
		}
		netConfig["ipam"] = ipamConfig
	}

	changes := map[string]any{
		"network_changes": map[string]any{
			networkName: netConfig,
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

	fmt.Printf("Successfully created network '%s'\n", networkName)
	return nil
}

func runDeleteNetwork(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	networkName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	if networkName == "default" {
		printError("cannot delete the default network")
		os.Exit(1)
	}

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if !networkExists(config, networkName) {
		printError("network '%s' not found in stack", networkName)
		os.Exit(1)
	}

	using := getServicesUsingNetwork(config, networkName)
	if len(using) > 0 {
		printError("network '%s' is in use by services: %v\nRemove services from the network first.", networkName, using)
		os.Exit(1)
	}

	changes := map[string]any{
		"network_changes": map[string]any{
			networkName: nil,
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

	fmt.Printf("Successfully deleted network '%s'\n", networkName)
	return nil
}
