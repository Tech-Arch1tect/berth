package auth

import (
	"berth/internal/apikey"
	"berth/utils"

	"github.com/labstack/echo/v4"
)

type RBACService interface {
	UserHasStackPermission(userID uint, serverID uint, stackName string, permissionName string) (bool, error)
	UserHasServerAccess(userID uint, serverID uint) (bool, error)
	GetUserAccessibleServerIDs(userID uint) ([]uint, error)
	GetUserStackPermissions(userID uint, serverID uint, stackName string) ([]string, error)
}

func CheckStackPermission(c echo.Context, rbacService RBACService, apiKeyService *apikey.Service, serverID uint, stackName string, permissionName string) (bool, error) {
	userID := GetUserID(c)
	if userID == 0 {
		return false, nil
	}

	userHasPermission, err := rbacService.UserHasStackPermission(userID, serverID, stackName, permissionName)
	if err != nil {
		return false, err
	}

	if IsJWTAuth(c) {
		return userHasPermission, nil
	}

	if IsAPIKeyAuth(c) {
		apiKey := GetAPIKey(c)
		if apiKey == nil {
			return false, nil
		}

		return apiKeyService.CheckAPIKeyPermission(apiKey, userHasPermission, serverID, stackName, permissionName)
	}

	return false, nil
}

func CheckServerAccess(c echo.Context, rbacService RBACService, apiKeyService *apikey.Service, serverID uint) (bool, error) {
	userID := GetUserID(c)
	if userID == 0 {
		return false, nil
	}

	userHasAccess, err := rbacService.UserHasServerAccess(userID, serverID)
	if err != nil {
		return false, err
	}

	if !userHasAccess {
		return false, nil
	}

	if IsJWTAuth(c) {
		return true, nil
	}

	if IsAPIKeyAuth(c) {
		apiKey := GetAPIKey(c)
		if apiKey == nil {
			return false, nil
		}

		for _, scope := range apiKey.Scopes {

			if scope.ServerID == nil || *scope.ServerID == serverID {
				return true, nil
			}
		}

		return false, nil
	}

	return false, nil
}

func GetAccessibleServerIDs(c echo.Context, rbacService RBACService, apiKeyService *apikey.Service) ([]uint, error) {
	userID := GetUserID(c)
	if userID == 0 {
		return []uint{}, nil
	}

	serverIDs, err := rbacService.GetUserAccessibleServerIDs(userID)
	if err != nil {
		return nil, err
	}

	if IsJWTAuth(c) {
		return serverIDs, nil
	}

	if IsAPIKeyAuth(c) {
		apiKey := GetAPIKey(c)
		if apiKey == nil {
			return []uint{}, nil
		}

		for _, scope := range apiKey.Scopes {
			if scope.ServerID == nil {
				return serverIDs, nil
			}
		}

		scopeServerMap := make(map[uint]bool)
		for _, scope := range apiKey.Scopes {
			if scope.ServerID != nil {
				scopeServerMap[*scope.ServerID] = true
			}
		}

		filteredIDs := []uint{}
		for _, serverID := range serverIDs {
			if scopeServerMap[serverID] {
				filteredIDs = append(filteredIDs, serverID)
			}
		}

		return filteredIDs, nil
	}

	return []uint{}, nil
}

func GetStackPermissions(c echo.Context, rbacService RBACService, apiKeyService *apikey.Service, serverID uint, stackName string) ([]string, error) {
	userID := GetUserID(c)
	if userID == 0 {
		return []string{}, nil
	}

	userPermissions, err := rbacService.GetUserStackPermissions(userID, serverID, stackName)
	if err != nil {
		return nil, err
	}

	if IsJWTAuth(c) {
		return userPermissions, nil
	}

	if IsAPIKeyAuth(c) {
		apiKey := GetAPIKey(c)
		if apiKey == nil {
			return []string{}, nil
		}

		apiKeyPermissions := make(map[string]bool)
		for _, scope := range apiKey.Scopes {

			if scope.ServerID != nil && *scope.ServerID != serverID {
				continue
			}

			if !utils.MatchesPattern(stackName, scope.StackPattern) {
				continue
			}

			apiKeyPermissions[scope.Permission.Name] = true
		}

		filteredPermissions := []string{}
		for _, perm := range userPermissions {
			if apiKeyPermissions[perm] {
				filteredPermissions = append(filteredPermissions, perm)
			}
		}

		return filteredPermissions, nil
	}

	return []string{}, nil
}
