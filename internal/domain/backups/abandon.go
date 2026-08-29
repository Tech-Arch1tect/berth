package backups

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"berth/internal/domain/server"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AbandonBackupStorageResult struct {
	Complete bool         `json:"complete"`
	Before   HistoryState `json:"before"`
	After    HistoryState `json:"after"`
	Errors   []string     `json:"errors"`
}

type agentAbandonBackupStorageResult struct {
	Complete *bool              `json:"complete"`
	Before   *agentHistoryState `json:"before"`
	After    *agentHistoryState `json:"after"`
	Errors   *[]string          `json:"errors"`
}

func validAbandonJSON(data []byte) bool {
	decoder := json.NewDecoder(bytes.NewReader(data))
	if !scanAbandonJSONFields(decoder) {
		return false
	}
	_, err := decoder.Token()
	return errors.Is(err, io.EOF)
}

func canonicalAbandonJSONField(field string) bool {
	switch field {
	case "complete", "before", "after", "errors", "empty", "stack_count", "record_count", "unreadable_record_count":
		return true
	default:
		return false
	}
}

func scanAbandonJSONFields(decoder *json.Decoder) bool {
	token, err := decoder.Token()
	if err != nil {
		return false
	}
	delimiter, ok := token.(json.Delim)
	if !ok {
		return true
	}
	switch delimiter {
	case '{':
		fields := make(map[string]struct{})
		for decoder.More() {
			fieldToken, err := decoder.Token()
			if err != nil {
				return false
			}
			field, ok := fieldToken.(string)
			if !ok || !canonicalAbandonJSONField(field) {
				return false
			}
			if _, exists := fields[field]; exists {
				return false
			}
			fields[field] = struct{}{}
			if !scanAbandonJSONFields(decoder) {
				return false
			}
		}
		closing, err := decoder.Token()
		return err == nil && closing == json.Delim('}')
	case '[':
		for decoder.More() {
			if !scanAbandonJSONFields(decoder) {
				return false
			}
		}
		closing, err := decoder.Token()
		return err == nil && closing == json.Delim(']')
	default:
		return false
	}
}

func (w agentAbandonBackupStorageResult) result(secrets []string) (AbandonBackupStorageResult, bool) {
	if w.Complete == nil || w.Before == nil || w.After == nil || w.Errors == nil {
		return AbandonBackupStorageResult{}, false
	}
	before, ok := w.Before.state()
	if !ok {
		return AbandonBackupStorageResult{}, false
	}
	after, ok := w.After.state()
	if !ok || after.StackCount > before.StackCount || after.RecordCount > before.RecordCount || after.UnreadableRecordCount > before.UnreadableRecordCount {
		return AbandonBackupStorageResult{}, false
	}
	recordsAbandoned := before.RecordCount - after.RecordCount
	if before.StackCount-after.StackCount > recordsAbandoned || before.UnreadableRecordCount-after.UnreadableRecordCount > recordsAbandoned {
		return AbandonBackupStorageResult{}, false
	}
	if !stringsExcludeSecrets(*w.Errors, secrets) {
		return AbandonBackupStorageResult{}, false
	}
	result := AbandonBackupStorageResult{
		Complete: *w.Complete,
		Before:   before,
		After:    after,
		Errors:   append([]string{}, (*w.Errors)...),
	}
	if result.Complete && (!result.After.Empty || len(result.Errors) != 0) {
		return AbandonBackupStorageResult{}, false
	}
	return result, true
}

func (r AbandonBackupStorageResult) auditMetadata() map[string]any {
	return map[string]any{
		"records_before":               r.Before.RecordCount,
		"records_abandoned":            r.Before.RecordCount - r.After.RecordCount,
		"records_remaining":            r.After.RecordCount,
		"stacks_before":                r.Before.StackCount,
		"stacks_abandoned":             r.Before.StackCount - r.After.StackCount,
		"stacks_remaining":             r.After.StackCount,
		"unreadable_records_before":    r.Before.UnreadableRecordCount,
		"unreadable_records_abandoned": r.Before.UnreadableRecordCount - r.After.UnreadableRecordCount,
		"unreadable_records_remaining": r.After.UnreadableRecordCount,
		"error_count":                  len(r.Errors),
		"complete":                     r.Complete,
		"repository_data_deleted":      false,
		"repository_data_verified":     false,
	}
}

func (s *Service) AbandonBackupStorage(ctx context.Context, serverID uint) (*AbandonBackupStorageResult, error) {
	release, err := s.ReserveBackupStorageWrite(serverID)
	if err != nil {
		if errors.Is(err, server.ErrBackupStorageBusy) || errors.Is(err, ErrRepositoryBusy) {
			return nil, ErrRepositoryBusy
		}
		return nil, fmt.Errorf("failed to reserve backup storage: %w", err)
	}
	defer release()

	srv, err := s.serverSvc.GetServer(serverID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrServerNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	resp, err := s.agentSvc.MakeLongRequest(ctx, srv, http.MethodPost, "/backups/abandon", nil)
	if err != nil {
		s.logger.Warn("failed to abandon backup storage through the agent",
			zap.Uint("server_id", serverID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("%w: agent request failed", ErrBackupStorageUnavailable)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusConflict {
		return nil, ErrRepositoryBusy
	}
	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("agent refused the backup storage abandonment request",
			zap.Uint("server_id", serverID),
			zap.Int("status_code", resp.StatusCode),
		)
		return nil, fmt.Errorf("%w: agent returned status %d", ErrBackupStorageUnavailable, resp.StatusCode)
	}

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil || !validAbandonJSON(responseBody) {
		s.logger.Warn("failed to read the backup storage abandonment result",
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("%w: agent response could not be decoded", ErrBackupStorageUnavailable)
	}
	decoder := json.NewDecoder(bytes.NewReader(responseBody))
	decoder.DisallowUnknownFields()
	var wireResult agentAbandonBackupStorageResult
	if err := decoder.Decode(&wireResult); err != nil {
		s.logger.Warn("failed to decode the backup storage abandonment result",
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("%w: agent response could not be decoded", ErrBackupStorageUnavailable)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		s.logger.Warn("rejected trailing data in the backup storage abandonment result",
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("%w: agent response contained trailing data", ErrBackupStorageUnavailable)
	}
	result, valid := wireResult.result([]string{srv.AccessToken, srv.BackupPassword})
	if !valid {
		s.logger.Warn("rejected an inconsistent backup storage abandonment result",
			zap.Uint("server_id", serverID),
		)
		return nil, fmt.Errorf("%w: agent response was inconsistent", ErrBackupStorageUnavailable)
	}
	return &result, nil
}
