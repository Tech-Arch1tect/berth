package main

import (
	"berth/internal/webhook/cli"
	"flag"
	"fmt"
	"os"
	"strings"
)

func main() {
	webhookID := flag.Uint("webhook-id", 0, "Webhook ID (required)")
	apiKey := flag.String("api-key", "", "Webhook API key (required)")
	serverID := flag.Uint("server-id", 0, "Server ID (required)")
	stackName := flag.String("stack", "", "Stack name (required)")
	command := flag.String("command", "", "Docker Compose command (required)")
	optionsStr := flag.String("options", "", "Comma-separated Docker Compose options")
	servicesStr := flag.String("services", "", "Comma-separated service names")
	berthURL := flag.String("berth-url", "", "Berth server URL (required)")
	insecure := flag.Bool("insecure", false, "Skip TLS verification")
	verbose := flag.Bool("verbose", false, "Enable verbose logging")
	timeoutMinutes := flag.Int("timeout", 35, "HTTP client timeout in minutes (default: 35)")

	flag.Parse()

	if *webhookID == 0 {
		fmt.Fprintf(os.Stderr, "Error: --webhook-id is required\n")
		os.Exit(7)
	}

	if *apiKey == "" {
		fmt.Fprintf(os.Stderr, "Error: --api-key is required\n")
		os.Exit(7)
	}

	if *serverID == 0 {
		fmt.Fprintf(os.Stderr, "Error: --server-id is required\n")
		os.Exit(7)
	}

	if *stackName == "" {
		fmt.Fprintf(os.Stderr, "Error: --stack is required\n")
		os.Exit(7)
	}

	if *command == "" {
		fmt.Fprintf(os.Stderr, "Error: --command is required\n")
		os.Exit(7)
	}

	if *berthURL == "" {
		fmt.Fprintf(os.Stderr, "Error: --berth-url is required\n")
		os.Exit(7)
	}

	var options []string
	if *optionsStr != "" {
		options = strings.Split(*optionsStr, ",")
		for i := range options {
			options[i] = strings.TrimSpace(options[i])
		}
	}

	var services []string
	if *servicesStr != "" {
		services = strings.Split(*servicesStr, ",")
		for i := range services {
			services[i] = strings.TrimSpace(services[i])
		}
	}

	config := &cli.Config{
		WebhookID:      uint(*webhookID),
		APIKey:         *apiKey,
		ServerID:       uint(*serverID),
		StackName:      *stackName,
		Command:        *command,
		Options:        options,
		Services:       services,
		BerthURL:       *berthURL,
		Insecure:       *insecure,
		Verbose:        *verbose,
		TimeoutMinutes: *timeoutMinutes,
	}

	exitCode := cli.Run(config)
	os.Exit(exitCode)
}
