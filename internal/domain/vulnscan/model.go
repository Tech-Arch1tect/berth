package vulnscan

import (
	"time"

	"berth/internal/domain/server"
	"berth/internal/platform/db"
)

const (
	ScanStatusPending   = "pending"
	ScanStatusRunning   = "running"
	ScanStatusCompleted = "completed"
	ScanStatusFailed    = "failed"
	ScanStatusTimeout   = "timeout"
)

type ImageScan struct {
	db.BaseModel
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

	ServiceFilter string `json:"service_filter,omitempty" gorm:"type:text"`

	Server          server.Server        `json:"-" gorm:"foreignKey:ServerID"`
	Vulnerabilities []ImageVulnerability `json:"vulnerabilities,omitempty" gorm:"foreignKey:ScanID"`

	Scopes []ScanScope `json:"scopes,omitempty" gorm:"foreignKey:ScanID"`
}

func (ImageScan) TableName() string {
	return "image_scans"
}

func (s *ImageScan) IsTerminal() bool {
	return s.Status == ScanStatusCompleted ||
		s.Status == ScanStatusFailed ||
		s.Status == ScanStatusTimeout
}

const (
	VulnSeverityCritical   = "Critical"
	VulnSeverityHigh       = "High"
	VulnSeverityMedium     = "Medium"
	VulnSeverityLow        = "Low"
	VulnSeverityNegligible = "Negligible"
	VulnSeverityUnknown    = "Unknown"
)

type ImageVulnerability struct {
	db.BaseModel
	ScanID           uint    `json:"scan_id" gorm:"not null;index"`
	ImageName        string  `json:"image_name" gorm:"not null;index"`
	VulnerabilityID  string  `json:"vulnerability_id" gorm:"not null;index"`
	Severity         string  `json:"severity" gorm:"not null;index"`
	Package          string  `json:"package" gorm:"not null"`
	InstalledVersion string  `json:"installed_version"`
	FixedVersion     string  `json:"fixed_version,omitempty"`
	Description      string  `json:"description,omitempty" gorm:"type:text"`
	DataSource       string  `json:"data_source,omitempty"`
	CVSS             float64 `json:"cvss,omitempty"`
	Location         string  `json:"location,omitempty"`
	LayerID          string  `json:"layer_id,omitempty"`
	RawMatch         string  `json:"raw_match,omitempty" gorm:"type:text"`

	Scan ImageScan `json:"-" gorm:"foreignKey:ScanID"`
}

func (ImageVulnerability) TableName() string {
	return "image_vulnerabilities"
}

type ScanScope struct {
	db.BaseModel
	ScanID    uint   `json:"scan_id" gorm:"not null;index;uniqueIndex:idx_scan_image"`
	ImageName string `json:"image_name" gorm:"not null;uniqueIndex:idx_scan_image"`

	Scan ImageScan `json:"-" gorm:"foreignKey:ScanID"`
}

func (ScanScope) TableName() string {
	return "scan_scopes"
}
