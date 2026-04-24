package inertia

import (
	"context"
	"testing"

	gonertia "github.com/romsar/gonertia/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeStore struct {
	data map[string]any
}

func newFakeStore() *fakeStore {
	return &fakeStore{data: map[string]any{}}
}

func (s *fakeStore) Put(_ context.Context, key string, value any) {
	s.data[key] = value
}

func (s *fakeStore) Pop(_ context.Context, key string) any {
	v, ok := s.data[key]
	if !ok {
		return nil
	}
	delete(s.data, key)
	return v
}

func resolverFor(s SessionStore) SessionStoreResolver {
	return func(context.Context) SessionStore { return s }
}

func TestFlashProvider_ValidationErrorsRoundTrip(t *testing.T) {
	store := newFakeStore()
	p := newscsFlashProvider(resolverFor(store))
	ctx := context.Background()

	errs := gonertia.ValidationErrors{"email": "is required"}
	require.NoError(t, p.FlashErrors(ctx, errs))
	assert.Equal(t, errs, store.data["validation_errors"])

	got, err := p.GetErrors(ctx)
	require.NoError(t, err)
	assert.Equal(t, errs, got)
	assert.NotContains(t, store.data, "validation_errors", "GetErrors must consume the value")

	got2, err := p.GetErrors(ctx)
	require.NoError(t, err)
	assert.Nil(t, got2)
}

func TestFlashProvider_FlashRoundTrip(t *testing.T) {
	store := newFakeStore()
	p := newscsFlashProvider(resolverFor(store))
	ctx := context.Background()

	flash := gonertia.Flash{"message": "hello"}
	require.NoError(t, p.Flash(ctx, flash))
	assert.Equal(t, flash, store.data["flash"])

	got, err := p.GetFlash(ctx)
	require.NoError(t, err)
	assert.Equal(t, flash, got)
	assert.NotContains(t, store.data, "flash")

	got2, err := p.GetFlash(ctx)
	require.NoError(t, err)
	assert.Nil(t, got2)
}

func TestFlashProvider_ClearHistoryRoundTrip(t *testing.T) {
	store := newFakeStore()
	p := newscsFlashProvider(resolverFor(store))
	ctx := context.Background()

	require.NoError(t, p.FlashClearHistory(ctx))
	assert.Equal(t, true, store.data["clear_history"])

	got, err := p.ShouldClearHistory(ctx)
	require.NoError(t, err)
	assert.True(t, got)
	assert.NotContains(t, store.data, "clear_history")

	got2, err := p.ShouldClearHistory(ctx)
	require.NoError(t, err)
	assert.False(t, got2)
}

func TestFlashProvider_NilStoreIsNoOp(t *testing.T) {
	p := newscsFlashProvider(func(context.Context) SessionStore { return nil })
	ctx := context.Background()

	assert.NoError(t, p.FlashErrors(ctx, gonertia.ValidationErrors{"x": "y"}))
	errs, err := p.GetErrors(ctx)
	assert.NoError(t, err)
	assert.Nil(t, errs)

	assert.NoError(t, p.Flash(ctx, gonertia.Flash{"m": "v"}))
	flash, err := p.GetFlash(ctx)
	assert.NoError(t, err)
	assert.Nil(t, flash)

	assert.NoError(t, p.FlashClearHistory(ctx))
	clear, err := p.ShouldClearHistory(ctx)
	assert.NoError(t, err)
	assert.False(t, clear)
}

func TestFlashProvider_NilResolverIsNoOp(t *testing.T) {
	p := newscsFlashProvider(nil)
	ctx := context.Background()

	assert.NoError(t, p.FlashErrors(ctx, gonertia.ValidationErrors{"x": "y"}))
	errs, err := p.GetErrors(ctx)
	assert.NoError(t, err)
	assert.Nil(t, errs)

	assert.NoError(t, p.Flash(ctx, gonertia.Flash{"m": "v"}))
	flash, err := p.GetFlash(ctx)
	assert.NoError(t, err)
	assert.Nil(t, flash)

	assert.NoError(t, p.FlashClearHistory(ctx))
	clear, err := p.ShouldClearHistory(ctx)
	assert.NoError(t, err)
	assert.False(t, clear)
}

func TestFlashProvider_WrongTypeInStoreReturnsZero(t *testing.T) {
	store := newFakeStore()
	p := newscsFlashProvider(resolverFor(store))
	ctx := context.Background()

	store.data["validation_errors"] = "not a ValidationErrors"
	errs, err := p.GetErrors(ctx)
	assert.NoError(t, err)
	assert.Nil(t, errs)

	store.data["flash"] = 42
	flash, err := p.GetFlash(ctx)
	assert.NoError(t, err)
	assert.Nil(t, flash)

	store.data["clear_history"] = "not a bool"
	clear, err := p.ShouldClearHistory(ctx)
	assert.NoError(t, err)
	assert.False(t, clear)
}
