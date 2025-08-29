package common

import (
	"brx-starter-kit/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/session"
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

	return 0, SendUnauthorized(c, "User not authenticated")
}
