package security

const (
	EventAuthLoginSuccess           = "auth.login.success"
	EventAuthLoginFailure           = "auth.login.failure"
	EventAuthLogout                 = "auth.logout"
	EventAuthPasswordResetRequested = "auth.password_reset.requested"
	EventAuthPasswordResetCompleted = "auth.password_reset.completed"
	EventAuthEmailVerified          = "auth.email.verified"
	EventAuthRememberMeCreated      = "auth.remember_me.created"
	EventAuthRememberMeInvalidated  = "auth.remember_me.invalidated"
	EventAuthSessionRevoked         = "auth.session.revoked"
	EventAuthSessionsRevokedAll     = "auth.sessions.revoked_all"
)

const (
	EventTOTPEnabled             = "totp.enabled"
	EventTOTPDisabled            = "totp.disabled"
	EventTOTPVerificationSuccess = "totp.verification.success"
	EventTOTPVerificationFailure = "totp.verification.failure"
	EventTOTPSetupInitiated      = "totp.setup.initiated"
)

const (
	EventUserCreated         = "user.created"
	EventUserDeleted         = "user.deleted"
	EventUserPasswordChanged = "user.password.changed"
	EventUserEmailChanged    = "user.email.changed"
	EventUserRoleAssigned    = "user.role.assigned"
	EventUserRoleRevoked     = "user.role.revoked"
)

const (
	EventRoleCreated       = "rbac.role.created"
	EventRoleUpdated       = "rbac.role.updated"
	EventRoleDeleted       = "rbac.role.deleted"
	EventPermissionAdded   = "rbac.permission.added"
	EventPermissionRemoved = "rbac.permission.removed"
)

const (
	EventServerCreated                = "server.created"
	EventServerUpdated                = "server.updated"
	EventServerDeleted                = "server.deleted"
	EventServerAccessTokenRegenerated = "server.access_token.regenerated"
	EventServerConnectionTestSuccess  = "server.connection.test_success"
	EventServerConnectionTestFailure  = "server.connection.test_failure"
)

const (
	EventAPITokenIssued    = "api.token.issued"
	EventAPITokenRefreshed = "api.token.refreshed"
	EventAPITokenRevoked   = "api.token.revoked"
	EventAPIAuthFailed     = "api.auth.failed"
)

const (
	EventFileUploaded   = "file.uploaded"
	EventFileDownloaded = "file.downloaded"
	EventFileDeleted    = "file.deleted"
	EventFileRenamed    = "file.renamed"
)

func GetEventCategory(eventType string) string {
	switch eventType {
	case EventAuthLoginSuccess, EventAuthLoginFailure, EventAuthLogout,
		EventAuthPasswordResetRequested, EventAuthPasswordResetCompleted,
		EventAuthEmailVerified, EventAuthRememberMeCreated, EventAuthRememberMeInvalidated,
		EventAuthSessionRevoked, EventAuthSessionsRevokedAll:
		return "auth"

	case EventTOTPEnabled, EventTOTPDisabled, EventTOTPVerificationSuccess,
		EventTOTPVerificationFailure, EventTOTPSetupInitiated:
		return "auth"

	case EventUserCreated, EventUserDeleted, EventUserPasswordChanged,
		EventUserEmailChanged, EventUserRoleAssigned, EventUserRoleRevoked:
		return "user_mgmt"

	case EventRoleCreated, EventRoleUpdated, EventRoleDeleted,
		EventPermissionAdded, EventPermissionRemoved:
		return "rbac"

	case EventServerCreated, EventServerUpdated, EventServerDeleted,
		EventServerAccessTokenRegenerated, EventServerConnectionTestSuccess,
		EventServerConnectionTestFailure:
		return "server"

	case EventAPITokenIssued, EventAPITokenRefreshed, EventAPITokenRevoked,
		EventAPIAuthFailed:
		return "api"

	case EventFileUploaded, EventFileDownloaded, EventFileDeleted, EventFileRenamed:
		return "file"

	default:
		return "unknown"
	}
}

func GetEventSeverity(eventType string) string {
	switch eventType {

	case EventUserDeleted, EventRoleDeleted, EventServerDeleted,
		EventServerAccessTokenRegenerated:
		return "critical"

	case EventAuthLoginFailure, EventTOTPVerificationFailure, EventAPIAuthFailed,
		EventUserCreated, EventUserRoleAssigned, EventUserRoleRevoked,
		EventRoleCreated, EventRoleUpdated, EventPermissionAdded, EventPermissionRemoved,
		EventServerCreated, EventServerUpdated, EventTOTPEnabled, EventTOTPDisabled:
		return "high"

	case EventAuthPasswordResetRequested, EventAuthPasswordResetCompleted,
		EventUserPasswordChanged, EventUserEmailChanged,
		EventServerConnectionTestFailure, EventFileDeleted, EventFileRenamed:
		return "medium"

	case EventAuthLoginSuccess, EventAuthLogout, EventAuthEmailVerified,
		EventAuthRememberMeCreated, EventAuthRememberMeInvalidated,
		EventAuthSessionRevoked, EventAuthSessionsRevokedAll,
		EventTOTPVerificationSuccess, EventTOTPSetupInitiated,
		EventAPITokenIssued, EventAPITokenRefreshed, EventAPITokenRevoked,
		EventServerConnectionTestSuccess,
		EventFileUploaded, EventFileDownloaded:
		return "low"

	default:
		return "medium"
	}
}
