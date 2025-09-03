package operations

import (
	"berth/models"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type AuditService struct {
	db *gorm.DB
}

func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{
		db: db,
	}
}

func (s *AuditService) LogOperationStart(userID uint, serverID uint, stackName string, operationID string, request OperationRequest, startTime time.Time) (*models.OperationLog, error) {
	options, _ := json.Marshal(request.Options)
	services, _ := json.Marshal(request.Services)

	log := &models.OperationLog{
		UserID:      userID,
		ServerID:    serverID,
		StackName:   stackName,
		OperationID: operationID,
		Command:     request.Command,
		Options:     string(options),
		Services:    string(services),
		StartTime:   startTime,
	}

	if err := s.db.Create(log).Error; err != nil {
		return nil, err
	}

	return log, nil
}

func (s *AuditService) LogOperationMessage(operationLogID uint, messageType string, messageData string, timestamp time.Time, sequenceNumber int) error {
	message := &models.OperationLogMessage{
		OperationLogID: operationLogID,
		MessageType:    messageType,
		MessageData:    messageData,
		Timestamp:      timestamp,
		SequenceNumber: sequenceNumber,
	}

	return s.db.Create(message).Error
}

func (s *AuditService) LogOperationEnd(operationLogID uint, endTime time.Time, success bool, exitCode int) error {
	log := &models.OperationLog{}
	if err := s.db.First(log, operationLogID).Error; err != nil {
		return err
	}

	duration := int(endTime.Sub(log.StartTime).Milliseconds())

	updates := map[string]any{
		"end_time":  endTime,
		"success":   success,
		"exit_code": exitCode,
		"duration":  duration,
	}

	return s.db.Model(log).Updates(updates).Error
}
