package authz

import (
	"berth/internal/domain/apikey"
	"berth/internal/domain/server"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/patterns"
	"slices"
)

const permStacksRead = "stacks.read"

type ScopeSet struct {
	serverIDs    []uint
	rolePatterns map[uint][]string
	keyScopes    []apikey.APIKeyScope
	hasKey       bool
	universal    bool
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
	roleMatch := false
	for _, p := range rolePs {
		if patterns.Matches(stackName, p) {
			roleMatch = true
			break
		}
	}
	if !roleMatch {
		return false
	}
	if !s.hasKey {
		return true
	}
	return checkAPIKeyStackScope(&apikey.APIKey{Scopes: s.keyScopes}, serverID, stackName, permStacksRead)
}

func (s ScopeSet) ServerIDs() []uint {
	if s.universal {
		return s.serverIDs
	}
	out := make([]uint, len(s.serverIDs))
	copy(out, s.serverIDs)
	return out
}

func (e *Engine) AuthorizedScope(p Principal) (ScopeSet, error) {
	if p.IsSystem() {
		var allIDs []uint
		if err := e.db.Model(&server.Server{}).Pluck("id", &allIDs).Error; err != nil {
			return ScopeSet{}, err
		}
		return ScopeSet{universal: true, serverIDs: allIDs}, nil
	}

	roleServerIDs, rolePatterns, err := e.computeRoleScope(p.UserID, p.Roles)
	if err != nil {
		return ScopeSet{}, err
	}

	serverIDs := roleServerIDs
	if p.APIKey != nil {
		serverIDs = filterByAPIKeyServerScopes(p.APIKey, serverIDs)
	}

	filteredPatterns := make(map[uint][]string, len(serverIDs))
	for _, sid := range serverIDs {
		if ps, ok := rolePatterns[sid]; ok {
			filteredPatterns[sid] = ps
		}
	}

	ks := ScopeSet{
		serverIDs:    serverIDs,
		rolePatterns: filteredPatterns,
		hasKey:       p.APIKey != nil,
	}
	if p.APIKey != nil {
		ks.keyScopes = p.APIKey.Scopes
	}
	return ks, nil
}

func (e *Engine) computeRoleScope(userID uint, roles []usermodel.Role) ([]uint, map[uint][]string, error) {
	for _, role := range roles {
		if role.IsAdmin {
			var allIDs []uint
			if err := e.db.Model(&server.Server{}).Pluck("id", &allIDs).Error; err != nil {
				return nil, nil, err
			}
			slices.Sort(allIDs)
			patMap := make(map[uint][]string, len(allIDs))
			for _, id := range allIDs {
				patMap[id] = []string{"*"}
			}
			return allIDs, patMap, nil
		}
	}

	var srsps []usermodel.ServerRoleStackPermission
	err := e.db.Preload("Permission").
		Joins("JOIN user_roles ON user_roles.role_id = server_role_stack_permissions.role_id").
		Where("user_roles.user_id = ?", userID).
		Find(&srsps).Error
	if err != nil {
		return nil, nil, err
	}

	serverIDSet := make(map[uint]bool)
	patternSets := make(map[uint]map[string]bool)
	for _, srsp := range srsps {
		if srsp.Permission.Name != permStacksRead {
			continue
		}
		if !serverIDSet[srsp.ServerID] {
			serverIDSet[srsp.ServerID] = true
			patternSets[srsp.ServerID] = make(map[string]bool)
		}
		patternSets[srsp.ServerID][srsp.StackPattern] = true
	}

	ids := make([]uint, 0, len(serverIDSet))
	for id := range serverIDSet {
		ids = append(ids, id)
	}
	slices.Sort(ids)

	patMap := make(map[uint][]string, len(ids))
	for _, id := range ids {
		patterns := make([]string, 0, len(patternSets[id]))
		for p := range patternSets[id] {
			patterns = append(patterns, p)
		}
		slices.Sort(patterns)
		patMap[id] = patterns
	}
	return ids, patMap, nil
}

func filterByAPIKeyServerScopes(key *apikey.APIKey, serverIDs []uint) []uint {
	for _, scope := range key.Scopes {
		if scope.ServerID == nil {
			return serverIDs
		}
	}
	scopeSet := make(map[uint]bool)
	for _, scope := range key.Scopes {
		if scope.ServerID != nil {
			scopeSet[*scope.ServerID] = true
		}
	}
	filtered := make([]uint, 0)
	for _, id := range serverIDs {
		if scopeSet[id] {
			filtered = append(filtered, id)
		}
	}
	return filtered
}
