package compose

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

var addPortCmd = &cobra.Command{
	Use:   "add-port <server-id> <stack-name> <service> <port-mapping>",
	Short: "Add a port mapping to a service",
	Long: `Add a port mapping to a service in a Docker Compose stack.

Port format: [host_ip:]published:target[/protocol]

Examples:
  # Add basic port mapping (host:container)
  berth-cli compose add-port 1 my-stack nginx 8080:80

  # Add port with protocol
  berth-cli compose add-port 1 my-stack nginx 443:443/tcp

  # Add port with host IP binding
  berth-cli compose add-port 1 my-stack nginx 127.0.0.1:8080:80

  # Skip confirmation
  berth-cli compose add-port --yes 1 my-stack nginx 8080:80`,
	Args: cobra.ExactArgs(4),
	RunE: runAddPort,
}

var removePortCmd = &cobra.Command{
	Use:   "remove-port <server-id> <stack-name> <service> <port-mapping>",
	Short: "Remove a port mapping from a service",
	Long: `Remove a port mapping from a service in a Docker Compose stack.

Port format: [host_ip:]published:target[/protocol]

Examples:
  # Remove port mapping
  berth-cli compose remove-port 1 my-stack nginx 8080:80

  # Skip confirmation
  berth-cli compose remove-port --yes 1 my-stack nginx 8080:80`,
	Args: cobra.ExactArgs(4),
	RunE: runRemovePort,
}

func init() {
	ComposeCmd.AddCommand(addPortCmd)
	ComposeCmd.AddCommand(removePortCmd)
	addPortCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
	removePortCmd.Flags().BoolP("yes", "y", false, "Skip confirmation and apply immediately")
}

type portMapping struct {
	HostIP    string
	Published string
	Target    string
	Protocol  string
}

func parsePortMapping(s string) (*portMapping, error) {
	pm := &portMapping{Protocol: "tcp"}

	if idx := strings.LastIndex(s, "/"); idx != -1 {
		pm.Protocol = s[idx+1:]
		s = s[:idx]
	}

	parts := strings.Split(s, ":")
	switch len(parts) {
	case 2:
		pm.Published = parts[0]
		pm.Target = parts[1]
	case 3:
		pm.HostIP = parts[0]
		pm.Published = parts[1]
		pm.Target = parts[2]
	default:
		return nil, fmt.Errorf("invalid port format: %s (expected [host_ip:]published:target[/protocol])", s)
	}

	return pm, nil
}

func portToMap(pm *portMapping) map[string]any {
	m := map[string]any{
		"target":    pm.Target,
		"published": pm.Published,
	}
	if pm.HostIP != "" {
		m["host_ip"] = pm.HostIP
	}
	if pm.Protocol != "" && pm.Protocol != "tcp" {
		m["protocol"] = pm.Protocol
	}
	return m
}

func getTargetPort(m map[string]any) string {
	switch v := m["target"].(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	default:
		return ""
	}
}

func portsMatch(a, b map[string]any) bool {

	aTarget := getTargetPort(a)
	bTarget := getTargetPort(b)

	aPublished, _ := a["published"].(string)
	bPublished, _ := b["published"].(string)

	return aTarget == bTarget && aPublished == bPublished
}

func normalisePortEntry(p any) (map[string]any, error) {
	switch v := p.(type) {
	case map[string]any:
		return v, nil
	case string:
		pm, err := parsePortMapping(v)
		if err != nil {
			return nil, err
		}
		return portToMap(pm), nil
	case float64:
		return map[string]any{
			"target":    strconv.FormatFloat(v, 'f', -1, 64),
			"published": "",
		}, nil
	case int:
		return map[string]any{
			"target":    strconv.Itoa(v),
			"published": "",
		}, nil
	default:
		return nil, fmt.Errorf("unsupported port format: %T", p)
	}
}

func getCurrentPorts(config map[string]any, serviceName string) ([]map[string]any, error) {
	services, ok := config["services"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("no services found")
	}

	service, ok := services[serviceName].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("service '%s' not found", serviceName)
	}

	portsRaw, ok := service["ports"]
	if !ok || portsRaw == nil {
		return []map[string]any{}, nil
	}

	portsSlice, ok := portsRaw.([]any)
	if !ok {
		return nil, fmt.Errorf("invalid ports format")
	}

	var ports []map[string]any
	for _, p := range portsSlice {
		normalised, err := normalisePortEntry(p)
		if err != nil {
			return nil, fmt.Errorf("invalid port entry: %v", err)
		}
		ports = append(ports, normalised)
	}

	return ports, nil
}

func runAddPort(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	portStr := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	newPort, err := parsePortMapping(portStr)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	currentPorts, err := getCurrentPorts(config, serviceName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	newPortMap := portToMap(newPort)
	for _, p := range currentPorts {
		if portsMatch(p, newPortMap) {
			printError("port mapping %s already exists", portStr)
			os.Exit(1)
		}
	}

	currentPorts = append(currentPorts, newPortMap)

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"ports": currentPorts,
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

	fmt.Printf("Successfully added port %s to service '%s'\n", portStr, serviceName)
	return nil
}

func runRemovePort(cmd *cobra.Command, args []string) error {
	serverID := args[0]
	stackName := args[1]
	serviceName := args[2]
	portStr := args[3]
	skipConfirm, _ := cmd.Flags().GetBool("yes")

	targetPort, err := parsePortMapping(portStr)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	config, err := getComposeConfig(cmd, serverID, stackName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	currentPorts, err := getCurrentPorts(config, serviceName)
	if err != nil {
		printError("%v", err)
		os.Exit(1)
	}

	targetPortMap := portToMap(targetPort)
	var newPorts []map[string]any
	found := false
	for _, p := range currentPorts {
		if portsMatch(p, targetPortMap) {
			found = true
			continue
		}
		newPorts = append(newPorts, p)
	}

	if !found {
		printError("port mapping %s not found", portStr)
		os.Exit(1)
	}

	changes := map[string]any{
		"service_changes": map[string]any{
			serviceName: map[string]any{
				"ports": newPorts,
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

	fmt.Printf("Successfully removed port %s from service '%s'\n", portStr, serviceName)
	return nil
}
