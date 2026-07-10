package seeds

import (
	"gorm.io/gorm"
)

func BackfillOperationLogUserNames(db *gorm.DB) error {
	var seedTracker SeedTracker
	result := db.Where("name = ?", "operation_logs_user_name_backfill").First(&seedTracker)
	if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
		return result.Error
	}

	if result.Error == gorm.ErrRecordNotFound {
		err := db.Exec(`UPDATE operation_logs
			SET user_name = COALESCE((SELECT username FROM users WHERE users.id = operation_logs.user_id), '')
			WHERE user_name IS NULL OR user_name = ''`).Error
		if err != nil {
			return err
		}

		if err := db.Create(&SeedTracker{Name: "operation_logs_user_name_backfill"}).Error; err != nil {
			return err
		}
	}

	return nil
}
