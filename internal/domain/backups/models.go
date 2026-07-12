package backups

import "time"

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
