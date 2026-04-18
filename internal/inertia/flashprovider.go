package inertia

import (
	"context"
	"encoding/gob"

	"berth/internal/session"

	gonertia "github.com/romsar/gonertia/v2"
)

func init() {
	gob.Register(gonertia.ValidationErrors{})
}

type scsFlashProvider struct{}

func newscsFlashProvider() *scsFlashProvider { return &scsFlashProvider{} }

func (p *scsFlashProvider) FlashErrors(ctx context.Context, errors gonertia.ValidationErrors) error {
	if m := session.GetManagerFromContext(ctx); m != nil {
		m.Put(ctx, "validation_errors", errors)
	}
	return nil
}

func (p *scsFlashProvider) GetErrors(ctx context.Context) (gonertia.ValidationErrors, error) {
	if m := session.GetManagerFromContext(ctx); m != nil {
		if v := m.Pop(ctx, "validation_errors"); v != nil {
			if errs, ok := v.(gonertia.ValidationErrors); ok {
				return errs, nil
			}
		}
	}
	return nil, nil
}

func (p *scsFlashProvider) FlashClearHistory(ctx context.Context) error {
	if m := session.GetManagerFromContext(ctx); m != nil {
		m.Put(ctx, "clear_history", true)
	}
	return nil
}

func (p *scsFlashProvider) ShouldClearHistory(ctx context.Context) (bool, error) {
	if m := session.GetManagerFromContext(ctx); m != nil {
		if v := m.Pop(ctx, "clear_history"); v != nil {
			if b, ok := v.(bool); ok {
				return b, nil
			}
		}
	}
	return false, nil
}
