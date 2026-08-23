package backups

import (
	"math"
	"strings"
	"time"
)

type Component struct {
	ID              string   `json:"id"`
	Kind            string   `json:"kind"`
	VolumeName      string   `json:"volume_name,omitempty"`
	SourcePath      string   `json:"source_path,omitempty"`
	Service         string   `json:"service,omitempty"`
	Target          string   `json:"target,omitempty"`
	Excludes        []string `json:"excludes,omitempty"`
	SnapshotID      string   `json:"snapshot_id,omitempty"`
	FilesNew        uint64   `json:"files_new"`
	FilesChanged    uint64   `json:"files_changed"`
	FilesUnmodified uint64   `json:"files_unmodified"`
	BytesAdded      uint64   `json:"bytes_added"`
	BytesProcessed  uint64   `json:"bytes_processed"`
	DurationSecs    float64  `json:"duration_secs"`
	Error           string   `json:"error,omitempty"`
}

type SkippedMount struct {
	Kind    string `json:"kind"`
	Service string `json:"service,omitempty"`
	Target  string `json:"target,omitempty"`
	Reason  string `json:"reason"`
}

type Run struct {
	ID            string         `json:"id"`
	StackName     string         `json:"stack_name"`
	StartedAt     time.Time      `json:"started_at"`
	FinishedAt    *time.Time     `json:"finished_at,omitempty"`
	Status        string         `json:"status"`
	Label         string         `json:"label,omitempty"`
	StopMode      string         `json:"stop_mode,omitempty"`
	ResticVersion string         `json:"restic_version,omitempty"`
	Verified      *bool          `json:"verified,omitempty"`
	VerifyError   string         `json:"verify_error,omitempty"`
	RepoSizeBytes uint64         `json:"repo_size_bytes,omitempty"`
	Components    []Component    `json:"components"`
	Skipped       []SkippedMount `json:"skipped,omitempty"`
	Error         string         `json:"error,omitempty"`
}

type RunSummary struct {
	ID                   string     `json:"id"`
	StackName            string     `json:"stack_name"`
	StartedAt            time.Time  `json:"started_at"`
	FinishedAt           *time.Time `json:"finished_at,omitempty"`
	Status               string     `json:"status"`
	Label                string     `json:"label,omitempty"`
	StopMode             string     `json:"stop_mode,omitempty"`
	Verified             *bool      `json:"verified,omitempty"`
	RepoSizeBytes        uint64     `json:"repo_size_bytes,omitempty"`
	SizeBytes            uint64     `json:"size_bytes"`
	AddedBytes           uint64     `json:"added_bytes"`
	ComponentCount       int        `json:"component_count"`
	ComponentsWithErrors int        `json:"components_with_errors"`
}

type ListResponse struct {
	Enabled    bool         `json:"enabled"`
	Configured bool         `json:"configured"`
	Total      int          `json:"total"`
	Runs       []RunSummary `json:"runs"`
}

type DeleteResponse struct {
	Message string `json:"message"`
}

type BackupFileEntry struct {
	Name  string    `json:"name"`
	Type  string    `json:"type"`
	Size  uint64    `json:"size"`
	MTime time.Time `json:"mtime"`
}

type BackupFileListing struct {
	Path    string            `json:"path"`
	Entries []BackupFileEntry `json:"entries"`
}

type StackBackupSummary struct {
	StackName     string      `json:"stack_name"`
	StackExists   bool        `json:"stack_exists"`
	RunCount      int         `json:"run_count"`
	LatestRun     *RunSummary `json:"latest_run,omitempty"`
	RepoSizeBytes uint64      `json:"repo_size_bytes,omitempty"`
}

type ServerBackups struct {
	ServerID   uint                 `json:"server_id"`
	ServerName string               `json:"server_name"`
	Enabled    bool                 `json:"enabled"`
	Configured bool                 `json:"configured"`
	Error      string               `json:"error,omitempty"`
	Stacks     []StackBackupSummary `json:"stacks"`
}

type OverviewResponse struct {
	Servers []ServerBackups `json:"servers"`
}

type HistoryState struct {
	Empty                 bool `json:"empty"`
	StackCount            int  `json:"stack_count"`
	RecordCount           int  `json:"record_count"`
	UnreadableRecordCount int  `json:"unreadable_record_count"`
}

type agentHistoryState struct {
	Empty                 *bool `json:"empty"`
	StackCount            *int  `json:"stack_count"`
	RecordCount           *int  `json:"record_count"`
	UnreadableRecordCount *int  `json:"unreadable_record_count"`
}

func (s agentHistoryState) state() (HistoryState, bool) {
	if s.Empty == nil || s.StackCount == nil || s.RecordCount == nil || s.UnreadableRecordCount == nil {
		return HistoryState{}, false
	}
	state := HistoryState{
		Empty:                 *s.Empty,
		StackCount:            *s.StackCount,
		RecordCount:           *s.RecordCount,
		UnreadableRecordCount: *s.UnreadableRecordCount,
	}
	return state, state.valid()
}

func (s HistoryState) valid() bool {
	if s.StackCount < 0 || s.RecordCount < 0 || s.UnreadableRecordCount < 0 {
		return false
	}
	if s.StackCount > s.RecordCount || s.UnreadableRecordCount > s.RecordCount {
		return false
	}
	return s.Empty == (s.RecordCount == 0)
}

type BackupPruneStatus string

const (
	BackupPruneNotNeeded    BackupPruneStatus = "not_needed"
	BackupPruneNotAttempted BackupPruneStatus = "not_attempted"
	BackupPruneSucceeded    BackupPruneStatus = "succeeded"
	BackupPruneFailed       BackupPruneStatus = "failed"
)

type DeleteAllStackResult struct {
	StackName          string            `json:"stack_name"`
	Attempted          bool              `json:"attempted"`
	RecordsBefore      int               `json:"records_before"`
	RecordsDeleted     int               `json:"records_deleted"`
	RecordsRemaining   int               `json:"records_remaining"`
	SnapshotsForgotten int               `json:"snapshots_forgotten"`
	PruneStatus        BackupPruneStatus `json:"prune_status"`
	Errors             []string          `json:"errors"`
}

type DeleteAllResult struct {
	Complete bool                   `json:"complete"`
	Before   HistoryState           `json:"before"`
	After    HistoryState           `json:"after"`
	Stacks   []DeleteAllStackResult `json:"stacks"`
	Errors   []string               `json:"errors"`
}

type agentDeleteAllStackResult struct {
	StackName          *string            `json:"stack_name"`
	Attempted          *bool              `json:"attempted"`
	RecordsBefore      *int               `json:"records_before"`
	RecordsDeleted     *int               `json:"records_deleted"`
	RecordsRemaining   *int               `json:"records_remaining"`
	SnapshotsForgotten *int               `json:"snapshots_forgotten"`
	PruneStatus        *BackupPruneStatus `json:"prune_status"`
	Errors             *[]string          `json:"errors"`
}

type agentDeleteAllResult struct {
	Complete *bool                        `json:"complete"`
	Before   *agentHistoryState           `json:"before"`
	After    *agentHistoryState           `json:"after"`
	Stacks   *[]agentDeleteAllStackResult `json:"stacks"`
	Errors   *[]string                    `json:"errors"`
}

func (s BackupPruneStatus) valid() bool {
	switch s {
	case BackupPruneNotNeeded, BackupPruneNotAttempted, BackupPruneSucceeded, BackupPruneFailed:
		return true
	default:
		return false
	}
}

func addMeasured(total, value int) (int, bool) {
	if value < 0 || total > math.MaxInt-value {
		return 0, false
	}
	return total + value, true
}

func stringsExcludeSecrets(values, secrets []string) bool {
	for _, value := range values {
		if value == "" {
			return false
		}
		for _, secret := range secrets {
			if secret != "" && strings.Contains(value, secret) {
				return false
			}
		}
	}
	return true
}

func (w agentDeleteAllResult) result(secrets []string) (DeleteAllResult, bool) {
	if w.Complete == nil || w.Before == nil || w.After == nil || w.Stacks == nil || w.Errors == nil {
		return DeleteAllResult{}, false
	}
	before, ok := w.Before.state()
	if !ok {
		return DeleteAllResult{}, false
	}
	after, ok := w.After.state()
	if !ok || after.RecordCount > before.RecordCount || after.UnreadableRecordCount != before.UnreadableRecordCount {
		return DeleteAllResult{}, false
	}
	if !stringsExcludeSecrets(*w.Errors, secrets) {
		return DeleteAllResult{}, false
	}

	result := DeleteAllResult{
		Complete: *w.Complete,
		Before:   before,
		After:    after,
		Stacks:   make([]DeleteAllStackResult, 0, len(*w.Stacks)),
		Errors:   append([]string{}, (*w.Errors)...),
	}
	var recordsBefore, recordsRemaining, snapshotsForgotten, stackErrors, stacksRemaining int
	previousStack := ""
	for _, stack := range *w.Stacks {
		if stack.StackName == nil || stack.Attempted == nil || stack.RecordsBefore == nil || stack.RecordsDeleted == nil || stack.RecordsRemaining == nil || stack.SnapshotsForgotten == nil || stack.PruneStatus == nil || stack.Errors == nil {
			return DeleteAllResult{}, false
		}
		if *stack.StackName == "" || previousStack != "" && *stack.StackName <= previousStack || !stack.PruneStatus.valid() {
			return DeleteAllResult{}, false
		}
		previousStack = *stack.StackName
		if *stack.RecordsBefore < 0 || *stack.RecordsDeleted < 0 || *stack.RecordsRemaining < 0 || *stack.SnapshotsForgotten < 0 || *stack.RecordsDeleted > *stack.RecordsBefore || *stack.RecordsRemaining > *stack.RecordsBefore || *stack.RecordsDeleted+*stack.RecordsRemaining != *stack.RecordsBefore {
			return DeleteAllResult{}, false
		}
		if !stringsExcludeSecrets(append([]string{*stack.StackName}, (*stack.Errors)...), secrets) {
			return DeleteAllResult{}, false
		}
		if !*stack.Attempted && (*stack.RecordsDeleted != 0 || *stack.RecordsRemaining != *stack.RecordsBefore || *stack.SnapshotsForgotten != 0 || *stack.PruneStatus != BackupPruneNotNeeded) {
			return DeleteAllResult{}, false
		}
		switch *stack.PruneStatus {
		case BackupPruneNotNeeded:
			if *stack.SnapshotsForgotten != 0 {
				return DeleteAllResult{}, false
			}
		case BackupPruneNotAttempted:
			if !*stack.Attempted || len(*stack.Errors) == 0 || *stack.RecordsRemaining == 0 {
				return DeleteAllResult{}, false
			}
		case BackupPruneFailed:
			if !*stack.Attempted || len(*stack.Errors) == 0 || *stack.RecordsRemaining == 0 || *stack.SnapshotsForgotten == 0 {
				return DeleteAllResult{}, false
			}
		case BackupPruneSucceeded:
			if !*stack.Attempted || *stack.SnapshotsForgotten == 0 {
				return DeleteAllResult{}, false
			}
		}
		if recordsBefore, ok = addMeasured(recordsBefore, *stack.RecordsBefore); !ok {
			return DeleteAllResult{}, false
		}
		if recordsRemaining, ok = addMeasured(recordsRemaining, *stack.RecordsRemaining); !ok {
			return DeleteAllResult{}, false
		}
		if snapshotsForgotten, ok = addMeasured(snapshotsForgotten, *stack.SnapshotsForgotten); !ok {
			return DeleteAllResult{}, false
		}
		if stackErrors, ok = addMeasured(stackErrors, len(*stack.Errors)); !ok {
			return DeleteAllResult{}, false
		}
		if *stack.RecordsRemaining > 0 {
			stacksRemaining++
		}
		result.Stacks = append(result.Stacks, DeleteAllStackResult{
			StackName:          *stack.StackName,
			Attempted:          *stack.Attempted,
			RecordsBefore:      *stack.RecordsBefore,
			RecordsDeleted:     *stack.RecordsDeleted,
			RecordsRemaining:   *stack.RecordsRemaining,
			SnapshotsForgotten: *stack.SnapshotsForgotten,
			PruneStatus:        *stack.PruneStatus,
			Errors:             append([]string{}, (*stack.Errors)...),
		})
	}

	reportedErrors, ok := addMeasured(len(result.Errors), stackErrors)
	if !ok || reportedErrors < before.UnreadableRecordCount {
		return DeleteAllResult{}, false
	}
	if len(result.Stacks) != before.StackCount || stacksRemaining != after.StackCount || recordsBefore > before.RecordCount || recordsRemaining > after.RecordCount || before.RecordCount-recordsBefore != after.RecordCount-recordsRemaining || len(result.Errors) != before.RecordCount-recordsBefore {
		return DeleteAllResult{}, false
	}
	complete := after.Empty && len(result.Errors) == 0
	for _, stack := range result.Stacks {
		if stack.RecordsRemaining != 0 || len(stack.Errors) != 0 {
			complete = false
		}
	}
	if result.Complete != complete {
		return DeleteAllResult{}, false
	}
	return result, true
}

func (r DeleteAllResult) auditMetadata() map[string]any {
	stacksAttempted := 0
	stacksNotAttempted := 0
	stacksSucceeded := 0
	stacksFailed := 0
	snapshotsForgotten := 0
	pruneFailures := 0
	for _, stack := range r.Stacks {
		if !stack.Attempted {
			stacksNotAttempted++
			continue
		}
		stacksAttempted++
		if stack.RecordsRemaining == 0 && len(stack.Errors) == 0 {
			stacksSucceeded++
		} else {
			stacksFailed++
		}
		snapshotsForgotten += stack.SnapshotsForgotten
		if stack.PruneStatus == BackupPruneFailed {
			pruneFailures++
		}
	}
	return map[string]any{
		"records_before":               r.Before.RecordCount,
		"records_deleted":              r.Before.RecordCount - r.After.RecordCount,
		"records_remaining":            r.After.RecordCount,
		"stacks_before":                r.Before.StackCount,
		"stacks_remaining":             r.After.StackCount,
		"unreadable_records_before":    r.Before.UnreadableRecordCount,
		"unreadable_records_remaining": r.After.UnreadableRecordCount,
		"stacks_attempted":             stacksAttempted,
		"stacks_not_attempted":         stacksNotAttempted,
		"stacks_succeeded":             stacksSucceeded,
		"stacks_failed":                stacksFailed,
		"snapshots_forgotten":          snapshotsForgotten,
		"prune_failures":               pruneFailures,
		"complete":                     r.Complete,
	}
}
