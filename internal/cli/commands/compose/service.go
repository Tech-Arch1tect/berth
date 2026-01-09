package compose

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var addServiceCmd = &cobra.Command{
	Use:   "add-service <server-id> <stack-name> <service-name> <image>",
	Short: "Add a new service to a stack",
	Long: `Add a new service to a Docker Compose stack.

The service is created with minimal configuration. Use other compose commands
to add ports, volumes, environment variables, etc. after creation.

Examples:
  # Add a basic service
  berth-cli compose add-service 1 my-stack redis redis:7-alpine

  # Add service with restart policy
  berth-cli compose add-service --restart always 1 my-stack nginx nginx:alpine

  # Skip confirmation
  berth-cli compose add-service --yes 1 my-stack api myapp:latest`,
	Args: cobra.ExactArgs(4),
	RunE: runAddService,
}

var removeServiceCmd = &cobra.Command{
	Use:   "remove-service <server-id> <stack-name> <service-name>",
	Short: "Remove a service from a stack",
	Long: `Remove a service from a Docker Compose stack.

This permanently removes the service definition from the compose file.

Examples:
  # Remove a service
  berth-cli compose remove-service 1 my-stack old-service

  # Skip confirmation
  berth-cli compose remove-service --yes 1 my-stack old-service`,
	Args: cobra.ExactArgs(3),
	RunE: runRemoveService,
}

var renameServiceCmd = &cobra.Command{
	Use:   "rename-service <server-id> <stack-name> <old-name> <new-name>",
	Short: "Rename a service in a stack",
	Long: `Rename a service in a Docker Compose stack.

This updates the service name while preserving all configuration.

Examples:
  # Rename a service
  berth-cli compose rename-service 1 my-stack old-name new-name

  # Skip confirmation
  berth-cli compose rename-service --yes 1 my-stack web frontend`,
	Args: cobra.ExactArgs(4),
	RunE: runRenameService,
}

func init() {
	ComposeCmd.AddCommand(addServiceCmd)
	ComposeCmd.AddCommand(removeServiceCmd)
	ComposeCmd.AddCommand(renameServiceCmd)

	addServiceCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	addServiceCmd.Flags().String("restart", "", "Restart policy (no, always, on-failure, unless-stopped)")

	removeServiceCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	renameServiceCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func getServiceNames(config map[string]any) []string {
	services, ok := config["services"].(map[string]any)
	if !ok {
		return nil
	}
	names := make([]string, 0, len(services))
	for name := range services {
		names = append(names, name)
	}
	return names
}

func serviceExists(config map[string]any, serviceName string) bool {
	services, ok := config["services"].(map[string]any)
	if !ok {
		return false
	}
	_, exists := services[serviceName]
	return exists
}

func runAddService(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	image := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")
	restart, _ := cmd.Flags().GetString("restart")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if serviceExists(config, serviceName) {
		printError("service '%s' already exists in stack", serviceName)
		os.Exit(1)
	}

	newService := map[string]any{
		"image": image,
	}
	if restart != "" {
		newService["restart"] = restart
	}

	changes := map[string]any{
		"add_services": map[string]any{
			serviceName: newService,
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

	fmt.Printf("Successfully added service '%s' with image '%s'\n", serviceName, image)
	return nil
}

func runRemoveService(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if !serviceExists(config, serviceName) {
		printError("service '%s' not found in stack", serviceName)
		os.Exit(1)
	}

	serviceNames := getServiceNames(config)
	if len(serviceNames) == 1 {
		printError("cannot remove the last service from a stack")
		os.Exit(1)
	}

	changes := map[string]any{
		"delete_services": []string{serviceName},
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

	fmt.Printf("Successfully removed service '%s'\n", serviceName)
	return nil
}

func runRenameService(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	oldName := args[2]
	newName := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	if oldName == newName {
		printError("old name and new name are the same")
		os.Exit(1)
	}

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if !serviceExists(config, oldName) {
		printError("service '%s' not found in stack", oldName)
		os.Exit(1)
	}

	if serviceExists(config, newName) {
		printError("service '%s' already exists in stack", newName)
		os.Exit(1)
	}

	changes := map[string]any{
		"rename_services": map[string]string{
			oldName: newName,
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

	fmt.Printf("Successfully renamed service '%s' to '%s'\n", oldName, newName)
	return nil
}
