package rbac

import (
	"slices"
	"testing"

	"berth/internal/domain/apikey"
	"berth/internal/domain/rbac/permnames"
	usermodel "berth/internal/domain/user"

	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func scopeOf(perm string, serverID *uint) apikey.APIKeyScope {
	return apikey.APIKeyScope{
		ServerID:     serverID,
		StackPattern: "*",
		Permission:   usermodel.Permission{Name: perm},
	}
}

func uptr(v uint) *uint { return &v }

func sortedCopy(ids []uint) []uint {
	out := append([]uint(nil), ids...)
	slices.Sort(out)
	return out
}

func TestFilterByListableScopes(t *testing.T) {
	roleSet := []uint{1, 2, 3}

	tests := []struct {
		name   string
		scopes []apikey.APIKeyScope
		want   []uint
	}{
		{
			name:   "no scopes returns empty",
			scopes: nil,
			want:   nil,
		},
		{
			name: "wildcard stacks.read preserves the role-derived set",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.StacksRead, nil),
			},
			want: roleSet,
		},
		{
			name: "per-server stacks.read narrows to that server",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.StacksRead, uptr(1)),
			},
			want: []uint{1},
		},
		{
			name: "two per-server stacks.read scopes return their union",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.StacksRead, uptr(1)),
				scopeOf(permnames.StacksRead, uptr(3)),
			},
			want: []uint{1, 3},
		},
		{
			name: "key with only servers.read on nil sees nothing — endpoint gate is not a visibility scope",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.ServersRead, nil),
			},
			want: nil,
		},
		{
			name: "key with only servers.read on a single server sees nothing — same reason",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.ServersRead, uptr(1)),
			},
			want: nil,
		},
		{
			name: "servers.read wildcard does not short-circuit a narrow stacks.read",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.ServersRead, nil),
				scopeOf(permnames.StacksRead, uptr(1)),
			},
			want: []uint{1},
		},
		{
			name: "servers.read on a different server does not widen stacks.read scope",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.StacksRead, uptr(1)),
				scopeOf(permnames.ServersRead, uptr(2)),
			},
			want: []uint{1},
		},
		{
			name: "wildcard and per-server stacks.read together still preserve the role set",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.StacksRead, nil),
				scopeOf(permnames.StacksRead, uptr(1)),
			},
			want: roleSet,
		},
		{
			name: "files.read scopes do not contribute either",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.FilesRead, nil),
				scopeOf(permnames.FilesRead, uptr(2)),
			},
			want: nil,
		},
	}

	svc := NewService(nil, zap.NewNop())

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			key := &apikey.APIKey{Scopes: tc.scopes}
			got := svc.filterByListableScopes(key, roleSet)

			gotSorted := sortedCopy(got)
			wantSorted := sortedCopy(tc.want)

			if len(gotSorted) == 0 {
				assert.Empty(t, gotSorted, "expected empty result")
			} else {
				assert.Equal(t, wantSorted, gotSorted)
			}
		})
	}
}

func TestFilterByReachableScopes(t *testing.T) {
	roleSet := []uint{1, 2, 3}

	tests := []struct {
		name   string
		scopes []apikey.APIKeyScope
		want   []uint
	}{
		{
			name:   "no scopes returns empty",
			scopes: nil,
			want:   nil,
		},
		{
			name: "wildcard scope of ANY permission preserves the role-derived set",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.ServersRead, nil),
			},
			want: roleSet,
		},
		{
			name: "per-server scope of non-stacks.read permission still grants membership",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.LogsRead, uptr(1)),
			},
			want: []uint{1},
		},
		{
			name: "union of per-server scopes across permissions",
			scopes: []apikey.APIKeyScope{
				scopeOf(permnames.LogsRead, uptr(1)),
				scopeOf(permnames.FilesWrite, uptr(2)),
			},
			want: []uint{1, 2},
		},
	}

	svc := NewService(nil, zap.NewNop())

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			key := &apikey.APIKey{Scopes: tc.scopes}
			got := svc.filterByReachableScopes(key, roleSet)

			gotSorted := sortedCopy(got)
			wantSorted := sortedCopy(tc.want)

			if len(gotSorted) == 0 {
				assert.Empty(t, gotSorted, "expected empty result")
			} else {
				assert.Equal(t, wantSorted, gotSorted)
			}
		})
	}
}
