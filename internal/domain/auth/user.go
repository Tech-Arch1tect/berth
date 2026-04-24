package auth

import (
	"berth/models"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type UserProvider interface {
	GetUser(userID uint) (any, error)
}

func GetCurrentUser(c echo.Context) any {
	return c.Get("currentUser")
}

type gormUserProvider struct {
	db *gorm.DB
}

func NewUserProvider(db *gorm.DB) UserProvider {
	return &gormUserProvider{db: db}
}

func (p *gormUserProvider) GetUser(userID uint) (any, error) {
	var user models.User
	if err := p.db.Preload("Roles").First(&user, userID).Error; err != nil {
		return nil, err
	}
	return user, nil
}
