package operations

import (
	"berth/models"
	"fmt"

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
	return "Operation 'pull' completed successfully"
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
