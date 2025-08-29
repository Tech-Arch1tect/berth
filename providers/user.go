package providers

import (
	"berth/models"
	"gorm.io/gorm"
)

type UserProvider struct {
	db *gorm.DB
}

func NewUserProvider(db *gorm.DB) *UserProvider {
	return &UserProvider{db: db}
}

func (up *UserProvider) GetUser(userID uint) (any, error) {
	var user models.User
	if err := up.db.Preload("Roles").First(&user, userID).Error; err != nil {
		return nil, err
	}
	return user, nil
}
