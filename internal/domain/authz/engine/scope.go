package engine

import (
	"slices"

	"berth/internal/domain/apikey"
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
	"berth/internal/domain/server"
	usermodel "berth/internal/domain/user"
)

func (e *Engine) AuthorizedScope(p Principal) (authz.ScopeSet, error) {
	if p.IsSystem() {
		var allIDs []uint
		if err := e.db.Model(&server.Server{}).Pluck("id", &allIDs).Error; err != nil {
			return authz.ScopeSet{}, err
		}
		slices.Sort(allIDs)
		return authz.NewScopeSet(allIDs, nil, nil, false, true), nil
	}

	roleServerIDs, rolePatterns, err := e.computeRoleScope(p.UserID, p.Roles)
	if err != nil {
		return authz.ScopeSet{}, err
	}

	serverIDs := roleServerIDs
	if p.APIKey != nil {
		serverIDs = filterByListableScopes(p.APIKey, serverIDs)
	}

	filteredPatterns := make(map[uint][]string, len(serverIDs))
	for _, sid := range serverIDs {
		if ps, ok := rolePatterns[sid]; ok {
			filteredPatterns[sid] = ps
		}
	}

	var keyPatterns map[uint][]string
	if p.APIKey != nil {
		keyPatterns = make(map[uint][]string, len(serverIDs))
		for _, sid := range serverIDs {
			keyPatterns[sid] = collectKeyStackPatterns(p.APIKey, sid)
		}
	}

	return authz.NewScopeSet(serverIDs, filteredPatterns, keyPatterns, p.APIKey != nil, false), nil
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
		if srsp.Permission.Name != permnames.StacksRead {
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
		ps := make([]string, 0, len(patternSets[id]))
		for p := range patternSets[id] {
			ps = append(ps, p)
		}
		slices.Sort(ps)
		patMap[id] = ps
	}
	return ids, patMap, nil
}

func filterByListableScopes(key *apikey.APIKey, serverIDs []uint) []uint {
	for _, scope := range key.Scopes {
		if scope.Permission.Name != permnames.StacksRead {
			continue
		}
		if scope.ServerID == nil {
			return serverIDs
		}
	}
	scopeSet := make(map[uint]bool)
	for _, scope := range key.Scopes {
		if scope.Permission.Name != permnames.StacksRead {
			continue
		}
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

func collectKeyStackPatterns(key *apikey.APIKey, serverID uint) []string {
	var out []string
	for _, scope := range key.Scopes {
		if scope.Permission.Name != permnames.StacksRead {
			continue
		}
		if scope.ServerID != nil && *scope.ServerID != serverID {
			continue
		}
		out = append(out, scope.StackPattern)
	}
	return out
}
