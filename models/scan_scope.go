package models

import "berth/internal/platform/db"

type ScanScope struct {
	db.BaseModel
	ScanID    uint   `json:"scan_id" gorm:"not null;index;uniqueIndex:idx_scan_image"`
	ImageName string `json:"image_name" gorm:"not null;uniqueIndex:idx_scan_image"`

	Scan ImageScan `json:"-" gorm:"foreignKey:ScanID"`
}

func (ScanScope) TableName() string {
	return "scan_scopes"
}
