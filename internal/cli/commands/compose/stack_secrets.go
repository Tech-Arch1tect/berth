package compose

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var createSecretCmd = &cobra.Command{
	Use:   "create-secret <server-id> <stack-name> <secret-name>",
	Short: "Create a secret in a stack",
	Long: `Create a new secret definition in a Docker Compose stack.

Secrets can be sourced from a file or environment variable.

Examples:
  # Create secret from file
  berth-cli compose create-secret --file ./secrets/db_password.txt 1 my-stack db_password

  # Create secret from environment variable
  berth-cli compose create-secret --environment DB_PASSWORD 1 my-stack db_password

  # Create an external secret reference
  berth-cli compose create-secret --external 1 my-stack existing-secret

  # Skip confirmation
  berth-cli compose create-secret --yes --file ./secret.txt 1 my-stack api_key`,
	Args: cobra.ExactArgs(3),
	RunE: runCreateSecret,
}

var deleteSecretCmd = &cobra.Command{
	Use:   "delete-secret <server-id> <stack-name> <secret-name>",
	Short: "Delete a secret from a stack",
	Long: `Delete a secret definition from a Docker Compose stack.

Examples:
  # Delete a secret
  berth-cli compose delete-secret 1 my-stack old-secret

  # Skip confirmation
  berth-cli compose delete-secret --yes 1 my-stack unused-secret`,
	Args: cobra.ExactArgs(3),
	RunE: runDeleteSecret,
}

func init() {
	ComposeCmd.AddCommand(createSecretCmd)
	ComposeCmd.AddCommand(deleteSecretCmd)

	createSecretCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	createSecretCmd.Flags().String("file", "", "Path to secret file")
	createSecretCmd.Flags().String("environment", "", "Environment variable containing the secret")
	createSecretCmd.Flags().Bool("external", false, "Mark as external secret")

	deleteSecretCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

func secretExists(config map[string]any, secretName string) bool {
	secrets, ok := config["secrets"].(map[string]any)
	if !ok {
		return false
	}
	_, exists := secrets[secretName]
	return exists
}

func runCreateSecret(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	secretName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")
	file, _ := cmd.Flags().GetString("file")
	environment, _ := cmd.Flags().GetString("environment")
	external, _ := cmd.Flags().GetBool("external")

	if file == "" && environment == "" && !external {
		printError("must specify --file, --environment, or --external")
		os.Exit(1)
	}

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if secretExists(config, secretName) {
		printError("secret '%s' already exists in stack", secretName)
		os.Exit(1)
	}

	secretConfig := map[string]any{}
	if file != "" {
		secretConfig["file"] = file
	}
	if environment != "" {
		secretConfig["environment"] = environment
	}
	if external {
		secretConfig["external"] = true
	}

	changes := map[string]any{
		"secret_changes": map[string]any{
			secretName: secretConfig,
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

	fmt.Printf("Successfully created secret '%s'\n", secretName)
	return nil
}

func runDeleteSecret(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	secretName := args[2]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	if !secretExists(config, secretName) {
		printError("secret '%s' not found in stack", secretName)
		os.Exit(1)
	}

	changes := map[string]any{
		"secret_changes": map[string]any{
			secretName: nil,
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

	fmt.Printf("Successfully deleted secret '%s'\n", secretName)
	return nil
}
