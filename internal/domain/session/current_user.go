package session

import (
	"net/http"

	"berth/internal/domain/user"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func GetCurrentUserID(c echo.Context) (uint, error) {
	if currentUser := c.Get("currentUser"); currentUser != nil {
		if userModel, ok := currentUser.(user.User); ok {
			return userModel.ID, nil
		}
	}

	return 0, echo.NewHTTPError(http.StatusUnauthorized, "User not authenticated")
}

func LoadCurrentUser(c echo.Context, db *gorm.DB) (*user.User, error) {
	if currentUser := c.Get("currentUser"); currentUser != nil {
		if userModel, ok := currentUser.(user.User); ok {
			return &userModel, nil
		}
	}

	return nil, echo.NewHTTPError(http.StatusUnauthorized, "User not authenticated")
}

func ResolveUsername(c echo.Context) string {
	if currentUser := c.Get("currentUser"); currentUser != nil {
		if userModel, ok := currentUser.(user.User); ok {
			return userModel.Username
		}
	}
	return ""
}
