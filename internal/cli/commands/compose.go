package commands

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"berth/internal/cli"

	"github.com/spf13/cobra"
)

var (
	composeServerID  string
	composeStack     string
	imageAssignments []string
	tagAssignments   []string
)

var composeCmd = &cobra.Command{
	Use:   "compose",
	Short: "Manage stack compose files",
	Long:  `Perform compose file operations such as updating service images or tags.`,
}

var composeSetImageCmd = &cobra.Command{
	Use:   "set-image",
	Short: "Update service images or tags",
	Long: `Update docker-compose service images by setting full image references or updating tags.

Provide one or more --set-image service=image[:tag] flags to replace entire image references.
Provide one or more --set-tag service=tag flags to update only the tag portion while keeping the current repository.`,
	RunE: runComposeSetImage,
}

func init() {
	rootCmd.AddCommand(composeCmd)
	composeCmd.AddCommand(composeSetImageCmd)

	composeCmd.PersistentFlags().StringVarP(&composeServerID, "server-id", "s", "", "Server ID (required)")
	composeCmd.PersistentFlags().StringVarP(&composeStack, "stack", "n", "", "Stack name (required)")
	composeCmd.MarkPersistentFlagRequired("server-id")
	composeCmd.MarkPersistentFlagRequired("stack")

	composeSetImageCmd.Flags().StringArrayVar(&imageAssignments, "set-image", nil, "Service=image[:tag] replacements (repeatable)")
	composeSetImageCmd.Flags().StringArrayVar(&tagAssignments, "set-tag", nil, "Service=tag replacements (repeatable)")
}

type composeChanges struct {
	ServiceImageUpdates []serviceImageUpdate `json:"service_image_updates,omitempty"`
}

type serviceImageUpdate struct {
	ServiceName string `json:"service_name"`
	NewImage    string `json:"new_image,omitempty"`
	NewTag      string `json:"new_tag,omitempty"`
}

type composeUpdateRequest struct {
	Changes composeChanges `json:"changes"`
}

func runComposeSetImage(cmd *cobra.Command, args []string) error {
	updates, err := buildServiceUpdates(imageAssignments, tagAssignments)
	if err != nil {
		return err
	}

	if len(updates) == 0 {
		return fmt.Errorf("provide at least one --set-image or --set-tag value")
	}

	config, err := cli.LoadConfig(GetAPIKey(), GetServerURL(), GetInsecure())
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	reqBody := composeUpdateRequest{
		Changes: composeChanges{ServiceImageUpdates: updates},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	serverPath := url.PathEscape(composeServerID)
	stackPath := url.PathEscape(composeStack)
	requestURL := fmt.Sprintf("%s/api/v1/servers/%s/stacks/%s/compose", config.ServerURL, serverPath, stackPath)

	httpReq, err := http.NewRequest(http.MethodPatch, requestURL, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+config.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	if config.Insecure {
		client.Transport = &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var apiErr map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err == nil {
			if msg, ok := apiErr["error"].(string); ok && msg != "" {
				return fmt.Errorf("compose update failed: %s", msg)
			}
		}
		return fmt.Errorf("compose update failed with status %s", resp.Status)
	}

	for _, update := range updates {
		if update.NewImage != "" {
			fmt.Printf("Service %s: image set to %s\n", update.ServiceName, update.NewImage)
		} else if update.NewTag != "" {
			fmt.Printf("Service %s: tag updated to %s\n", update.ServiceName, update.NewTag)
		}
	}

	fmt.Println("Compose file updated successfully")
	return nil
}

func buildServiceUpdates(imageAssignments, tagAssignments []string) ([]serviceImageUpdate, error) {
	updates := make(map[string]*serviceImageUpdate)

	addUpdate := func(service string) *serviceImageUpdate {
		if existing, ok := updates[service]; ok {
			return existing
		}
		entry := &serviceImageUpdate{ServiceName: service}
		updates[service] = entry
		return entry
	}

	for _, assignment := range imageAssignments {
		service, value, err := splitAssignment(assignment)
		if err != nil {
			return nil, fmt.Errorf("invalid --set-image value %q: %w", assignment, err)
		}
		if value == "" {
			return nil, fmt.Errorf("invalid --set-image value %q: image cannot be empty", assignment)
		}
		addUpdate(service).NewImage = value
	}

	for _, assignment := range tagAssignments {
		service, value, err := splitAssignment(assignment)
		if err != nil {
			return nil, fmt.Errorf("invalid --set-tag value %q: %w", assignment, err)
		}
		if value == "" {
			return nil, fmt.Errorf("invalid --set-tag value %q: tag cannot be empty", assignment)
		}
		addUpdate(service).NewTag = value
	}

	if len(updates) == 0 {
		return nil, nil
	}

	keys := make([]string, 0, len(updates))
	for service := range updates {
		keys = append(keys, service)
	}
	sort.Strings(keys)

	result := make([]serviceImageUpdate, 0, len(updates))
	for _, service := range keys {
		result = append(result, *updates[service])
	}

	return result, nil
}

func splitAssignment(input string) (string, string, error) {
	parts := strings.SplitN(input, "=", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("expected format service=value")
	}
	service := strings.TrimSpace(parts[0])
	value := strings.TrimSpace(parts[1])
	if service == "" {
		return "", "", fmt.Errorf("service name must not be empty")
	}
	return service, value, nil
}
