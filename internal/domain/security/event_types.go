package security

const (
	EventAuthLoginSuccess           = "auth.login.success"
	EventAuthLoginFailure           = "auth.login.failure"
	EventAuthLogout                 = "auth.logout"
	EventAuthPasswordResetRequested = "auth.password_reset.requested"
	EventAuthPasswordResetCompleted = "auth.password_reset.completed"
	EventAuthEmailVerified          = "auth.email.verified"
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
	EventAPIKeyCreated          = "apikey.created"
	EventAPIKeyRevoked          = "apikey.revoked"
	EventAPIKeyScopeAdded       = "apikey.scope.added"
	EventAPIKeyScopeRemoved     = "apikey.scope.removed"
	EventAPIKeyValidationFailed = "apikey.validation.failed"
)

const (
	EventStackCreated       = "stack.created"
	EventStackDeleted       = "stack.deleted"
	EventStackSecretsViewed = "stack.secrets.viewed"
)

const (
	EventDockerPruneExecuted   = "docker.prune.executed"
	EventDockerResourceDeleted = "docker.resource.deleted"
)

const (
	EventAuthorizationDenied = "authorization.denied"
)

const (
	EventFileUploaded   = "file.uploaded"
	EventFileDownloaded = "file.downloaded"
	EventFileDeleted    = "file.deleted"
	EventFileRenamed    = "file.renamed"
)

const (
	EventRegistryCredentialCreated = "registry_credential_created"
	EventRegistryCredentialUpdated = "registry_credential_updated"
	EventRegistryCredentialDeleted = "registry_credential_deleted"
)

func GetEventCategory(eventType string) string {
	switch eventType {
	case EventAuthLoginSuccess, EventAuthLoginFailure, EventAuthLogout,
		EventAuthPasswordResetRequested, EventAuthPasswordResetCompleted,
		EventAuthEmailVerified,
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

	case EventAPIKeyCreated, EventAPIKeyRevoked, EventAPIKeyScopeAdded,
		EventAPIKeyScopeRemoved, EventAPIKeyValidationFailed:
		return "apikey"

	case EventStackCreated, EventStackDeleted, EventStackSecretsViewed:
		return "stack"

	case EventDockerPruneExecuted, EventDockerResourceDeleted:
		return "docker"

	case EventAuthorizationDenied:
		return "authorization"

	case EventFileUploaded, EventFileDownloaded, EventFileDeleted, EventFileRenamed:
		return "file"

	case EventRegistryCredentialCreated, EventRegistryCredentialUpdated, EventRegistryCredentialDeleted:
		return CategoryRegistry

	default:
		return "unknown"
	}
}

func GetEventSeverity(eventType string) string {
	switch eventType {

	case EventUserDeleted, EventRoleDeleted, EventServerDeleted,
		EventServerAccessTokenRegenerated,
		EventAPIKeyRevoked, EventStackDeleted, EventDockerPruneExecuted:
		return "critical"

	case EventAuthLoginFailure, EventTOTPVerificationFailure, EventAPIAuthFailed,
		EventUserCreated, EventUserRoleAssigned, EventUserRoleRevoked,
		EventRoleCreated, EventRoleUpdated, EventPermissionAdded, EventPermissionRemoved,
		EventServerCreated, EventServerUpdated, EventTOTPEnabled, EventTOTPDisabled,
		EventAPIKeyCreated, EventAPIKeyScopeAdded, EventAPIKeyScopeRemoved,
		EventStackCreated, EventStackSecretsViewed, EventDockerResourceDeleted,
		EventAuthorizationDenied:
		return "high"

	case EventAuthPasswordResetRequested, EventAuthPasswordResetCompleted,
		EventUserPasswordChanged, EventUserEmailChanged,
		EventServerConnectionTestFailure, EventFileDeleted, EventFileRenamed,
		EventAPIKeyValidationFailed,
		EventRegistryCredentialCreated, EventRegistryCredentialUpdated, EventRegistryCredentialDeleted:
		return "medium"

	case EventAuthLoginSuccess, EventAuthLogout, EventAuthEmailVerified,
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
