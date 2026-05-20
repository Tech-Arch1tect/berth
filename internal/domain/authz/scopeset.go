package authz

import (
	"berth/internal/pkg/patterns"

	"github.com/labstack/echo/v4"
)

const ScopeSetKey = "_authz_scope_set"

type ScopeSet struct {
	serverIDs    []uint
	rolePatterns map[uint][]string
	keyPatterns  map[uint][]string
	hasKey       bool
	universal    bool
}

func NewScopeSet(serverIDs []uint, rolePatterns, keyPatterns map[uint][]string, hasKey, universal bool) ScopeSet {
	return ScopeSet{
		serverIDs:    serverIDs,
		rolePatterns: rolePatterns,
		keyPatterns:  keyPatterns,
		hasKey:       hasKey,
		universal:    universal,
	}
}

func (s ScopeSet) AllowsServer(serverID uint) bool {
	if s.universal {
		return true
	}
	for _, id := range s.serverIDs {
		if id == serverID {
			return true
		}
	}
	return false
}

func (s ScopeSet) AllowsStack(serverID uint, stackName string) bool {
	if s.universal {
		return true
	}
	rolePs, ok := s.rolePatterns[serverID]
	if !ok {
		return false
	}
	if !matchAny(stackName, rolePs) {
		return false
	}
	if !s.hasKey {
		return true
	}
	keyPs, ok := s.keyPatterns[serverID]
	if !ok {
		return false
	}
	return matchAny(stackName, keyPs)
}

func (s ScopeSet) ServerIDs() []uint {
	if s.universal {
		return s.serverIDs
	}
	out := make([]uint, len(s.serverIDs))
	copy(out, s.serverIDs)
	return out
}

func matchAny(s string, patternList []string) bool {
	for _, p := range patternList {
		if patterns.Matches(s, p) {
			return true
		}
	}
	return false
}

func GetScopeSet(c echo.Context) (ScopeSet, bool) {
	v := c.Get(ScopeSetKey)
	if v == nil {
		return ScopeSet{}, false
	}
	s, ok := v.(ScopeSet)
	return s, ok
}
