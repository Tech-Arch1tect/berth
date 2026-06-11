package dbschema

import (
	"berth/internal/domain/auth"
	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/auth/totp"
	"berth/internal/domain/imageupdates"
	"berth/internal/domain/operationlogs"
	"berth/internal/domain/security"
	"berth/internal/domain/server"
	"berth/internal/domain/session"
	"berth/internal/domain/vulnscan"
	"berth/seeds"
)

func Models() []any {
	return append(seeds.RBACModels(),
		&server.ServerRegistryCredential{},
		&operationlogs.OperationLog{}, &operationlogs.OperationLogMessage{},
		&security.SecurityAuditLog{},
		&session.UserSession{},
		&imageupdates.ContainerImageUpdate{},
		&vulnscan.ImageScan{}, &vulnscan.ImageVulnerability{}, &vulnscan.ScanScope{},
		&totp.TOTPSecret{}, &totp.UsedCode{},
		&auth.PasswordResetToken{}, &auth.EmailVerificationToken{},
		&tokens.RevokedToken{}, &tokens.RefreshToken{},
	)
}
