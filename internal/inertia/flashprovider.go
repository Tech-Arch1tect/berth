package inertia

import (
	"context"
	"encoding/gob"

	gonertia "github.com/romsar/gonertia/v3"
)

func init() {
	gob.Register(gonertia.ValidationErrors{})
	gob.Register(gonertia.Flash{})
}

type scsFlashProvider struct {
	resolve SessionStoreResolver
}

func newscsFlashProvider(resolve SessionStoreResolver) *scsFlashProvider {
	return &scsFlashProvider{resolve: resolve}
}

func (p *scsFlashProvider) store(ctx context.Context) SessionStore {
	if p.resolve == nil {
		return nil
	}
	return p.resolve(ctx)
}

func (p *scsFlashProvider) FlashErrors(ctx context.Context, errors gonertia.ValidationErrors) error {
	if s := p.store(ctx); s != nil {
		s.Put(ctx, "validation_errors", errors)
	}
	return nil
}

func (p *scsFlashProvider) GetErrors(ctx context.Context) (gonertia.ValidationErrors, error) {
	if s := p.store(ctx); s != nil {
		if v := s.Pop(ctx, "validation_errors"); v != nil {
			if errs, ok := v.(gonertia.ValidationErrors); ok {
				return errs, nil
			}
		}
	}
	return nil, nil
}

func (p *scsFlashProvider) Flash(ctx context.Context, flash gonertia.Flash) error {
	if s := p.store(ctx); s != nil {
		s.Put(ctx, "flash", flash)
	}
	return nil
}

func (p *scsFlashProvider) GetFlash(ctx context.Context) (gonertia.Flash, error) {
	if s := p.store(ctx); s != nil {
		if v := s.Pop(ctx, "flash"); v != nil {
			if f, ok := v.(gonertia.Flash); ok {
				return f, nil
			}
		}
	}
	return nil, nil
}

func (p *scsFlashProvider) FlashClearHistory(ctx context.Context) error {
	if s := p.store(ctx); s != nil {
		s.Put(ctx, "clear_history", true)
	}
	return nil
}

func (p *scsFlashProvider) ShouldClearHistory(ctx context.Context) (bool, error) {
	if s := p.store(ctx); s != nil {
		if v := s.Pop(ctx, "clear_history"); v != nil {
			if b, ok := v.(bool); ok {
				return b, nil
			}
		}
	}
	return false, nil
}
