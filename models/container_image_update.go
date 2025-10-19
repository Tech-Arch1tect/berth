package models

import "time"

type ContainerImageUpdate struct {
	BaseModel
	ServerID          uint       `json:"server_id" gorm:"not null;index:idx_server_stack_container"`
	StackName         string     `json:"stack_name" gorm:"not null;index:idx_server_stack_container"`
	ContainerName     string     `json:"container_name" gorm:"not null;index:idx_server_stack_container"`
	CurrentImageName  string     `json:"current_image_name" gorm:"not null"`
	CurrentRepoDigest string     `json:"current_repo_digest" gorm:"type:text"`
	LatestRepoDigest  string     `json:"latest_repo_digest" gorm:"type:text"`
	UpdateAvailable   bool       `json:"update_available" gorm:"index"`
	LastCheckedAt     *time.Time `json:"last_checked_at" gorm:"index"`
	CheckError        string     `json:"check_error" gorm:"type:text"`
	Server            Server     `json:"server" gorm:"foreignKey:ServerID"`
}

func (ContainerImageUpdate) TableName() string {
	return "container_image_updates"
}
