package authz

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestScopeSet_Universal_AllowsEverything(t *testing.T) {
	s := NewScopeSet([]uint{1, 2}, nil, nil, false, true)
	assert.True(t, s.AllowsServer(1))
	assert.True(t, s.AllowsServer(999))
	assert.True(t, s.AllowsStack(1, "anything"))
	assert.True(t, s.AllowsStack(999, "anything"))
}

func TestScopeSet_AllowsServer_ListMembership(t *testing.T) {
	s := NewScopeSet([]uint{2, 5}, nil, nil, false, false)
	assert.True(t, s.AllowsServer(2))
	assert.True(t, s.AllowsServer(5))
	assert.False(t, s.AllowsServer(3))
}

func TestScopeSet_AllowsStack_RoleOnly_PatternMatches(t *testing.T) {
	s := NewScopeSet(
		[]uint{1},
		map[uint][]string{1: {"prod-*"}},
		nil,
		false,
		false,
	)
	assert.True(t, s.AllowsStack(1, "prod-web"))
	assert.False(t, s.AllowsStack(1, "staging-web"))
	assert.False(t, s.AllowsStack(2, "prod-web"))
}

func TestScopeSet_AllowsStack_RoleAndKey_BothMustMatch(t *testing.T) {
	s := NewScopeSet(
		[]uint{1},
		map[uint][]string{1: {"*"}},
		map[uint][]string{1: {"prod-*"}},
		true,
		false,
	)
	assert.True(t, s.AllowsStack(1, "prod-web"))
	assert.False(t, s.AllowsStack(1, "staging-web"), "role allows but key restricts")
}

func TestScopeSet_AllowsStack_KeyMissingServerEntry(t *testing.T) {
	s := NewScopeSet(
		[]uint{1, 2},
		map[uint][]string{1: {"*"}, 2: {"*"}},
		map[uint][]string{1: {"*"}},
		true,
		false,
	)
	assert.True(t, s.AllowsStack(1, "anything"))
	assert.False(t, s.AllowsStack(2, "anything"), "key has no scope for server 2")
}

func TestScopeSet_AllowsStack_NoKey_RoleSufficient(t *testing.T) {
	s := NewScopeSet(
		[]uint{1},
		map[uint][]string{1: {"*"}},
		nil,
		false,
		false,
	)
	assert.True(t, s.AllowsStack(1, "anything"))
}

func TestScopeSet_ServerIDs_ReturnsCopy(t *testing.T) {
	src := []uint{3, 1, 2}
	s := NewScopeSet(src, nil, nil, false, false)
	got := s.ServerIDs()
	got[0] = 99
	assert.Equal(t, uint(3), src[0], "ServerIDs() must not expose the underlying slice")
}

func TestScopeSet_ServerIDs_Universal_ReturnsAllIDs(t *testing.T) {
	s := NewScopeSet([]uint{1, 2}, nil, nil, false, true)
	assert.Equal(t, []uint{1, 2}, s.ServerIDs())
}

func TestGetScopeSet_Absent_ReturnsNotOK(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	c := e.NewContext(req, httptest.NewRecorder())

	_, ok := GetScopeSet(c)
	assert.False(t, ok)
}

func TestGetScopeSet_Present_RoundTrips(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	c := e.NewContext(req, httptest.NewRecorder())

	want := NewScopeSet([]uint{7}, nil, nil, false, false)
	c.Set(ScopeSetKey, want)

	got, ok := GetScopeSet(c)
	assert.True(t, ok)
	assert.True(t, got.AllowsServer(7))
	assert.False(t, got.AllowsServer(8))
}
