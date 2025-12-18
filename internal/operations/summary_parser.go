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
	return "Operation 'up' completed successfully"
}

func (p *SummaryParser) parseDownSummary(messages []models.OperationLogMessage) string {
	return "Operation 'down' completed successfully"
}

func (p *SummaryParser) parseRestartSummary(messages []models.OperationLogMessage) string {
	return "Operation 'restart' completed successfully"
}

func (p *SummaryParser) parseStartSummary(messages []models.OperationLogMessage) string {
	return "Operation 'start' completed successfully"
}

func (p *SummaryParser) parseStopSummary(messages []models.OperationLogMessage) string {
	return "Operation 'stop' completed successfully"
}

func (p *SummaryParser) parseGenericSummary(command string) string {
	return fmt.Sprintf("Operation '%s' completed successfully", command)
}
