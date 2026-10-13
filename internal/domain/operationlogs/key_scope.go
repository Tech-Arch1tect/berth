package operationlogs

import (
	"strings"

	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"

	"gorm.io/gorm"
)

var operationLogPatternEscaper = strings.NewReplacer("!", "!!", "%", "!%", "_", "!_", "*", "%")

func applyOperationLogKeyScope(query *gorm.DB, key *authz.KeyDescriptor) *gorm.DB {
	if key == nil {
		return query
	}

	var conditions []string
	var args []any
	for _, scope := range key.Scopes {
		if scope.Permission != permnames.LogsOperationsRead {
			continue
		}
		condition := "LOWER(stack_name) LIKE ? ESCAPE '!'"
		if scope.ServerID != nil {
			condition = "server_id = ? AND " + condition
			args = append(args, *scope.ServerID)
		}
		args = append(args, operationLogPatternEscaper.Replace(strings.ToLower(scope.StackPattern)))
		conditions = append(conditions, "("+condition+")")
	}
	if len(conditions) == 0 {
		return query.Where("1 = 0")
	}
	return query.Where("("+strings.Join(conditions, " OR ")+")", args...)
}
