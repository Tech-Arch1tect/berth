package inertia

import (
	"context"

	"github.com/labstack/echo/v4"
)

type SessionStore interface {
	Put(ctx context.Context, key string, value any)
	Pop(ctx context.Context, key string) any
}

type SessionStoreResolver func(ctx context.Context) SessionStore

type IsAuthenticatedFunc func(c echo.Context) bool

type UserIDFunc func(c echo.Context) uint

type FlashMessagesFunc func(c echo.Context) any
