package errpage

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakePages struct {
	called    bool
	component string
	props     gonertia.Props
	err       error
}

func (f *fakePages) Render(_ echo.Context, component string, props gonertia.Props) error {
	f.called = true
	f.component = component
	f.props = props
	return f.err
}

func newCtx() (echo.Context, *httptest.ResponseRecorder) {
	e := echo.New()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	return e.NewContext(req, rec), rec
}

func TestRenderer_RendersErrorsGenericWithCodeAndMessage(t *testing.T) {
	pages := &fakePages{}
	c, _ := newCtx()

	require.NoError(t, New(pages).Render(c, http.StatusNotFound, "Server not found"))

	assert.True(t, pages.called)
	assert.Equal(t, "Errors/Generic", pages.component)
	assert.Equal(t, http.StatusNotFound, pages.props["code"])
	assert.Equal(t, "Server not found", pages.props["message"])
}

func TestRenderer_WritesGivenStatusToResponse(t *testing.T) {
	cases := []int{
		http.StatusBadRequest,
		http.StatusUnauthorized,
		http.StatusForbidden,
		http.StatusNotFound,
		http.StatusConflict,
		http.StatusInternalServerError,
		http.StatusBadGateway,
	}
	for _, status := range cases {
		t.Run(fmt.Sprintf("status %d", status), func(t *testing.T) {
			pages := &fakePages{}
			c, rec := newCtx()

			require.NoError(t, New(pages).Render(c, status, "msg"))

			assert.Equal(t, status, c.Response().Status)
			assert.Equal(t, status, rec.Code)
			assert.Equal(t, status, pages.props["code"])
		})
	}
}

func TestRenderer_PropagatesPageRendererError(t *testing.T) {
	boom := errors.New("render failed")
	pages := &fakePages{err: boom}
	c, _ := newCtx()

	err := New(pages).Render(c, http.StatusInternalServerError, "X")

	require.ErrorIs(t, err, boom)
}
