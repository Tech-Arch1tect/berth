package s3buckets

import (
	"berth/internal/platform/db"
)

type S3Bucket struct {
	db.BaseModel
	Label       string `json:"label" gorm:"not null"`
	Endpoint    string `json:"endpoint" gorm:"not null"`
	Region      string `json:"region" gorm:"not null;default:us-east-1"`
	BucketName  string `json:"bucket_name" gorm:"not null"`
	AccessKeyID string `json:"access_key_id" gorm:"not null"`
	SecretKey   string `json:"secret_key" gorm:"not null"`
}
