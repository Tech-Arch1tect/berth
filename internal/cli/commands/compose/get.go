package compose

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	outputFormat string
	fieldFilter  string
)

var getCmd = &cobra.Command{
	Use:   "get <server-id> <stack-name> [service]",
	Short: "Get compose configuration",
	Long: `Retrieve and display the compose configuration for a stack.

Examples:
  # Get full stack config as YAML
  berth-cli compose get 1 my-stack

  # Get specific service config
  berth-cli compose get 1 my-stack nginx

  # Output as JSON
  berth-cli compose get 1 my-stack --output json

  # Get specific field from a service
  berth-cli compose get 1 my-stack nginx --field image
  berth-cli compose get 1 my-stack nginx --field environment
  berth-cli compose get 1 my-stack nginx --field ports`,
	Args: cobra.RangeArgs(2, 3),
	RunE: runGet,
}

func init() {
	ComposeCmd.AddCommand(getCmd)
	getCmd.Flags().StringVarP(&outputFormat, "output", "o", "yaml", "Output format: yaml, json")
	getCmd.Flags().StringVarP(&fieldFilter, "field", "f", "", "Extract specific field (e.g., image, ports, environment)")
}

func runGet(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	var serviceName string
	if len(args) > 2 {
		serviceName = args[2]
	}

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	var output any = config

	if serviceName != "" {
		services, ok := config["services"].(map[string]any)
		if !ok {
			printError("no services found in compose config")
			os.Exit(1)
		}

		service, ok := services[serviceName]
		if !ok {
			printError("service '%s' not found", serviceName)
			os.Exit(1)
		}

		output = service

		if fieldFilter != "" {
			serviceMap, ok := service.(map[string]any)
			if !ok {
				printError("invalid service format")
				os.Exit(1)
			}

			fieldValue, ok := serviceMap[fieldFilter]
			if !ok {
				printError("field '%s' not found in service '%s'", fieldFilter, serviceName)
				os.Exit(1)
			}

			output = fieldValue
		}
	} else if fieldFilter != "" {
		printError("--field requires a service name")
		os.Exit(1)
	}

	switch strings.ToLower(outputFormat) {
	case "json":
		formatted, err := formatJSON(output)
		if err != nil {
			printError("failed to format JSON: %v", err)
			os.Exit(1)
		}
		fmt.Println(formatted)

	case "yaml":
		formatted, err := formatYAML(output)
		if err != nil {
			printError("failed to format YAML: %v", err)
			os.Exit(1)
		}
		fmt.Print(formatted)

	default:
		printError("unknown output format: %s (use 'yaml' or 'json')", outputFormat)
		os.Exit(1)
	}

	return nil
}

func formatYAML(data any) (string, error) {
	b, err := yaml.Marshal(data)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
