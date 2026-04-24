package app

import (
	"context"

	"berth/internal/domain/session"
	"berth/internal/platform/inertia"

	"github.com/labstack/echo/v4"
)

func SessionStoreResolver(ctx context.Context) inertia.SessionStore {
	m := session.GetManagerFromContext(ctx)
	if m == nil {
		return nil
	}
	return m
}

func InertiaFlashMessages(c echo.Context) any {
	msgs := session.GetFlashMessages(c)
	if msgs == nil {
		return nil
	}
	return msgs
}
