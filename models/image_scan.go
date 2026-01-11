package models

import "time"

const (
	ScanStatusPending   = "pending"
	ScanStatusRunning   = "running"
	ScanStatusCompleted = "completed"
	ScanStatusFailed    = "failed"
	ScanStatusTimeout   = "timeout"
)

type ImageScan struct {
	BaseModel
	ServerID      uint       `json:"server_id" gorm:"not null;index:idx_server_stack"`
	StackName     string     `json:"stack_name" gorm:"not null;index:idx_server_stack"`
	AgentScanID   string     `json:"agent_scan_id" gorm:"index"`
	Status        string     `json:"status" gorm:"not null;index"`
	TotalImages   int        `json:"total_images"`
	ScannedImages int        `json:"scanned_images"`
	StartedAt     time.Time  `json:"started_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	ErrorMessage  string     `json:"error_message,omitempty" gorm:"type:text"`

	LastPolledAt  *time.Time `json:"last_polled_at,omitempty"`
	PollFailures  int        `json:"poll_failures"`
	LastPollError string     `json:"last_poll_error,omitempty" gorm:"type:text"`

	Server          Server               `json:"-" gorm:"foreignKey:ServerID"`
	Vulnerabilities []ImageVulnerability `json:"vulnerabilities,omitempty" gorm:"foreignKey:ScanID"`
}

func (ImageScan) TableName() string {
	return "image_scans"
}

func (s *ImageScan) IsTerminal() bool {
	return s.Status == ScanStatusCompleted ||
		s.Status == ScanStatusFailed ||
		s.Status == ScanStatusTimeout
}
