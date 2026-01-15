package common

import (
	"berth/models"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/session"
	"gorm.io/gorm"
)

func GetCurrentUserID(c echo.Context) (uint, error) {
	if currentUser := jwtshared.GetCurrentUser(c); currentUser != nil {
		if userModel, ok := currentUser.(models.User); ok {
			return userModel.ID, nil
		}
	}

	if userID := session.GetUserIDAsUint(c); userID != 0 {
		return userID, nil
	}

	return 0, echo.NewHTTPError(http.StatusUnauthorized, "User not authenticated")
}

func GetCurrentUser(c echo.Context, db *gorm.DB) (*models.User, error) {
	if currentUser := jwtshared.GetCurrentUser(c); currentUser != nil {
		if userModel, ok := currentUser.(models.User); ok {
			return &userModel, nil
		}
	}

	if userID := session.GetUserIDAsUint(c); userID != 0 {
		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			return nil, echo.NewHTTPError(http.StatusUnauthorized, "User not found")
		}
		return &user, nil
	}

	return nil, echo.NewHTTPError(http.StatusUnauthorized, "User not authenticated")
}
