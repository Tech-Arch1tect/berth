package operations

import (
	"berth/models"
	"fmt"
	"strings"

	"github.com/tech-arch1tect/brx/services/logging"
)

type SummaryParser struct {
	logger *logging.Service
}

func NewSummaryParser(logger *logging.Service) *SummaryParser {
	return &SummaryParser{
		logger: logger,
	}
}

func (p *SummaryParser) GenerateSummary(
	command string,
	success bool,
	exitCode int,
	messages []models.OperationLogMessage,
) string {
	if !success {
		return p.generateFailureSummary(command, exitCode)
	}

	switch command {
	case "pull":
		return p.parsePullSummary(messages)
	case "up":
		return p.parseUpSummary(messages)
	case "down":
		return p.parseDownSummary(messages)
	case "restart":
		return p.parseRestartSummary(messages)
	case "start":
		return p.parseStartSummary(messages)
	case "stop":
		return p.parseStopSummary(messages)
	default:
		return p.parseGenericSummary(command)
	}
}

func (p *SummaryParser) generateFailureSummary(command string, exitCode int) string {
	return fmt.Sprintf("Operation '%s' failed with exit code %d", command, exitCode)
}

func (p *SummaryParser) parsePullSummary(messages []models.OperationLogMessage) string {
	servicesWithUpdates := make(map[string]bool)
	allServices := make(map[string]bool)
	hasLayerActivity := false

	for _, msg := range messages {
		data := strings.TrimSpace(msg.MessageData)

		if strings.HasSuffix(data, "Pulling") {
			serviceName := strings.TrimSuffix(data, " Pulling")
			serviceName = strings.TrimSpace(serviceName)
			allServices[serviceName] = true
		}

		if strings.Contains(data, "Pulling fs layer") ||
			strings.Contains(data, "Downloading") ||
			strings.Contains(data, "Download complete") ||
			strings.Contains(data, "Pull complete") ||
			strings.Contains(data, "Extracting") {
			hasLayerActivity = true
		}

		if strings.HasSuffix(data, "Pulled") {
			serviceName := strings.TrimSuffix(data, " Pulled")
			serviceName = strings.TrimSpace(serviceName)
			if hasLayerActivity {
				servicesWithUpdates[serviceName] = true
			}
			hasLayerActivity = false
		}
	}

	var pulledServices []string
	var upToDateServices []string

	for service := range allServices {
		if servicesWithUpdates[service] {
			pulledServices = append(pulledServices, service)
		} else {
			upToDateServices = append(upToDateServices, service)
		}
	}

	if len(pulledServices) == 0 && len(upToDateServices) == 0 {
		return "Images checked"
	}

	if len(pulledServices) > 0 && len(upToDateServices) == 0 {
		return fmt.Sprintf("Pulled new images for %s", p.formatServiceList(pulledServices))
	}

	if len(pulledServices) == 0 && len(upToDateServices) > 0 {
		return "All images up to date"
	}

	return fmt.Sprintf("Pulled new images for %s; %s already up to date",
		p.formatServiceList(pulledServices),
		p.formatServiceList(upToDateServices))
}

func (p *SummaryParser) formatServiceList(services []string) string {
	if len(services) == 0 {
		return ""
	}
	if len(services) == 1 {
		return services[0]
	}
	if len(services) == 2 {
		return services[0] + " and " + services[1]
	}
	if len(services) <= 4 {
		last := services[len(services)-1]
		rest := strings.Join(services[:len(services)-1], ", ")
		return rest + " and " + last
	}
	first := strings.Join(services[:3], ", ")
	remaining := len(services) - 3
	if remaining == 1 {
		return first + " and 1 other"
	}
	return fmt.Sprintf("%s and %d others", first, remaining)
}

func (p *SummaryParser) parseUpSummary(messages []models.OperationLogMessage) string {
	containersStarted := make(map[string]bool)
	networksCreated := make(map[string]bool)
	volumesCreated := make(map[string]bool)

	for _, msg := range messages {
		data := strings.TrimSpace(msg.MessageData)

		if strings.HasPrefix(data, "Container ") && strings.HasSuffix(data, " Started") {
			name := strings.TrimPrefix(data, "Container ")
			name = strings.TrimSuffix(name, " Started")
			name = strings.TrimSpace(name)
			containersStarted[name] = true
		}

		if strings.HasPrefix(data, "Network ") && strings.HasSuffix(data, " Created") {
			name := strings.TrimPrefix(data, "Network ")
			name = strings.TrimSuffix(name, " Created")
			name = strings.TrimSpace(name)
			networksCreated[name] = true
		}

		if strings.HasPrefix(data, "Volume ") && strings.HasSuffix(data, " Created") {
			name := strings.TrimPrefix(data, "Volume ")
			name = strings.TrimSuffix(name, " Created")
			name = strings.TrimSpace(name)
			volumesCreated[name] = true
		}
	}

	var containerList []string
	for name := range containersStarted {
		containerList = append(containerList, name)
	}

	var networkList []string
	for name := range networksCreated {
		networkList = append(networkList, name)
	}

	var volumeList []string
	for name := range volumesCreated {
		volumeList = append(volumeList, name)
	}

	var parts []string

	if len(containerList) > 0 {
		parts = append(parts, fmt.Sprintf("Started %s", p.formatServiceList(containerList)))
	}

	if len(networkList) > 0 {
		parts = append(parts, fmt.Sprintf("created %s", p.formatResourceList("network", networkList)))
	}

	if len(volumeList) > 0 {
		parts = append(parts, fmt.Sprintf("created %s", p.formatResourceList("volume", volumeList)))
	}

	if len(parts) == 0 {
		return "Stack started"
	}

	return strings.Join(parts, "; ")
}

func (p *SummaryParser) formatResourceList(resourceType string, resources []string) string {
	if len(resources) == 0 {
		return ""
	}
	if len(resources) == 1 {
		return fmt.Sprintf("1 %s (%s)", resourceType, resources[0])
	}
	if len(resources) == 2 {
		return fmt.Sprintf("2 %ss (%s and %s)", resourceType, resources[0], resources[1])
	}
	if len(resources) <= 4 {
		last := resources[len(resources)-1]
		rest := strings.Join(resources[:len(resources)-1], ", ")
		return fmt.Sprintf("%d %ss (%s and %s)", len(resources), resourceType, rest, last)
	}
	first := strings.Join(resources[:3], ", ")
	remaining := len(resources) - 3
	return fmt.Sprintf("%d %ss (%s and %d others)", len(resources), resourceType, first, remaining)
}

func (p *SummaryParser) parseDownSummary(messages []models.OperationLogMessage) string {
	containersStopped := make(map[string]bool)
	containersRemoved := make(map[string]bool)
	networksRemoved := make(map[string]bool)
	volumesRemoved := make(map[string]bool)

	for _, msg := range messages {
		data := strings.TrimSpace(msg.MessageData)

		if strings.HasPrefix(data, "Container ") && strings.HasSuffix(data, " Stopped") {
			name := strings.TrimPrefix(data, "Container ")
			name = strings.TrimSuffix(name, " Stopped")
			name = strings.TrimSpace(name)
			containersStopped[name] = true
		}

		if strings.HasPrefix(data, "Container ") && strings.HasSuffix(data, " Removed") {
			name := strings.TrimPrefix(data, "Container ")
			name = strings.TrimSuffix(name, " Removed")
			name = strings.TrimSpace(name)
			containersRemoved[name] = true
		}

		if strings.HasPrefix(data, "Network ") && strings.HasSuffix(data, " Removed") {
			name := strings.TrimPrefix(data, "Network ")
			name = strings.TrimSuffix(name, " Removed")
			name = strings.TrimSpace(name)
			networksRemoved[name] = true
		}

		if strings.HasPrefix(data, "Volume ") && strings.HasSuffix(data, " Removed") {
			name := strings.TrimPrefix(data, "Volume ")
			name = strings.TrimSuffix(name, " Removed")
			name = strings.TrimSpace(name)
			volumesRemoved[name] = true
		}
	}

	var stoppedList []string
	for name := range containersStopped {
		stoppedList = append(stoppedList, name)
	}

	var removedList []string
	for name := range containersRemoved {
		removedList = append(removedList, name)
	}

	var networkList []string
	for name := range networksRemoved {
		networkList = append(networkList, name)
	}

	var volumeList []string
	for name := range volumesRemoved {
		volumeList = append(volumeList, name)
	}

	var parts []string

	if len(stoppedList) > 0 {
		parts = append(parts, fmt.Sprintf("Stopped %s", p.formatServiceList(stoppedList)))
	}

	if len(removedList) > 0 {
		parts = append(parts, fmt.Sprintf("removed %s", p.formatServiceList(removedList)))
	}

	if len(networkList) > 0 {
		parts = append(parts, fmt.Sprintf("removed %s", p.formatResourceList("network", networkList)))
	}

	if len(volumeList) > 0 {
		parts = append(parts, fmt.Sprintf("removed %s", p.formatResourceList("volume", volumeList)))
	}

	if len(parts) == 0 {
		return "Stack stopped"
	}

	return strings.Join(parts, "; ")
}

func (p *SummaryParser) parseRestartSummary(messages []models.OperationLogMessage) string {
	containersRestarted := make(map[string]bool)

	for _, msg := range messages {
		data := strings.TrimSpace(msg.MessageData)

		if strings.HasPrefix(data, "Container ") && (strings.HasSuffix(data, " Restarted") || strings.HasSuffix(data, " Started")) {
			name := strings.TrimPrefix(data, "Container ")
			name = strings.TrimSuffix(name, " Restarted")
			name = strings.TrimSuffix(name, " Started")
			name = strings.TrimSpace(name)
			containersRestarted[name] = true
		}
	}

	var restartedList []string
	for name := range containersRestarted {
		restartedList = append(restartedList, name)
	}

	if len(restartedList) == 0 {
		return "Containers restarted"
	}

	return fmt.Sprintf("Restarted %s", p.formatServiceList(restartedList))
}

func (p *SummaryParser) parseStartSummary(messages []models.OperationLogMessage) string {
	containersStarted := make(map[string]bool)

	for _, msg := range messages {
		data := strings.TrimSpace(msg.MessageData)

		if strings.HasPrefix(data, "Container ") && strings.HasSuffix(data, " Started") {
			name := strings.TrimPrefix(data, "Container ")
			name = strings.TrimSuffix(name, " Started")
			name = strings.TrimSpace(name)
			containersStarted[name] = true
		}
	}

	var startedList []string
	for name := range containersStarted {
		startedList = append(startedList, name)
	}

	if len(startedList) == 0 {
		return "Containers started"
	}

	return fmt.Sprintf("Started %s", p.formatServiceList(startedList))
}

func (p *SummaryParser) parseStopSummary(messages []models.OperationLogMessage) string {
	containersStopped := make(map[string]bool)

	for _, msg := range messages {
		data := strings.TrimSpace(msg.MessageData)

		if strings.HasPrefix(data, "Container ") && strings.HasSuffix(data, " Stopped") {
			name := strings.TrimPrefix(data, "Container ")
			name = strings.TrimSuffix(name, " Stopped")
			name = strings.TrimSpace(name)
			containersStopped[name] = true
		}
	}

	var stoppedList []string
	for name := range containersStopped {
		stoppedList = append(stoppedList, name)
	}

	if len(stoppedList) == 0 {
		return "Containers stopped"
	}

	return fmt.Sprintf("Stopped %s", p.formatServiceList(stoppedList))
}

func (p *SummaryParser) parseGenericSummary(command string) string {
	return fmt.Sprintf("Operation '%s' completed successfully", command)
}
