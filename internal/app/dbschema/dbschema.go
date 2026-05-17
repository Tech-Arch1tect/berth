package dbschema

import (
	"berth/internal/domain/apikey"
	"berth/internal/domain/auth"
	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/auth/totp"
	"berth/internal/domain/imageupdates"
	"berth/internal/domain/operationlogs"
	"berth/internal/domain/queue"
	"berth/internal/domain/security"
	"berth/internal/domain/server"
	"berth/internal/domain/session"
	"berth/internal/domain/user"
	"berth/internal/domain/vulnscan"
	"berth/seeds"
)

func Models() []any {
	return []any{
		&user.User{}, &user.Role{}, &user.Permission{},
		&server.Server{}, &user.ServerRoleStackPermission{}, &server.ServerRegistryCredential{},
		&apikey.APIKey{}, &apikey.APIKeyScope{},
		&operationlogs.OperationLog{}, &operationlogs.OperationLogMessage{},
		&security.SecurityAuditLog{},
		&seeds.SeedTracker{},
		&queue.QueuedOperation{}, &session.UserSession{},
		&imageupdates.ContainerImageUpdate{},
		&vulnscan.ImageScan{}, &vulnscan.ImageVulnerability{}, &vulnscan.ScanScope{},
		&totp.TOTPSecret{}, &totp.UsedCode{},
		&auth.PasswordResetToken{}, &auth.EmailVerificationToken{},
		&tokens.RevokedToken{}, &tokens.RefreshToken{},
	}
}
