package auth

import "github.com/labstack/echo/v4"

type UserProvider interface {
	GetUser(userID uint) (any, error)
}

func GetCurrentUser(c echo.Context) any {
	return c.Get("currentUser")
}
