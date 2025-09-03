package config

import "os"

func EnforceRequiredSettings() {
	enforceSecuritySettings()
	enforceDatabaseSettings()
	enforceInertiaSettings()
	enforceSessionSettings()
	enforceAuthSettings()
	enforceTOTPSettings()
	enforceJWTSettings()
	enforceRefreshTokenSettings()
	enforceJWTRevocationSettings()
	enforceRateLimitSettings()
	enforceCSRFSettings()
}

func enforceSecuritySettings() {
	os.Setenv("SESSION_SECURE", "true")
	os.Setenv("SESSION_HTTP_ONLY", "true")
	os.Setenv("SESSION_SAME_SITE", "strict")

	os.Setenv("AUTH_REMEMBER_ME_COOKIE_SECURE", "true")
	os.Setenv("AUTH_REMEMBER_ME_COOKIE_SAME_SITE", "strict")

	os.Setenv("CSRF_COOKIE_SECURE", "true")
	os.Setenv("CSRF_COOKIE_HTTP_ONLY", "true")
	os.Setenv("CSRF_COOKIE_SAME_SITE", "strict")
}

func enforceDatabaseSettings() {
	os.Setenv("DATABASE_AUTO_MIGRATE", "true")
}

func enforceInertiaSettings() {
	os.Setenv("INERTIA_ENABLED", "true")
	os.Setenv("INERTIA_ROOT_VIEW", "app.html")
	os.Setenv("INERTIA_VERSION", "1.0")
	os.Setenv("INERTIA_SSR_ENABLED", "false")
}

func enforceSessionSettings() {
	os.Setenv("SESSION_ENABLED", "true")
	os.Setenv("SESSION_STORE", "database")
	os.Setenv("SESSION_NAME", "berth")
}

func enforceAuthSettings() {
	os.Setenv("AUTH_EMAIL_VERIFICATION_TOKEN_LENGTH", "32")
	os.Setenv("AUTH_EMAIL_VERIFICATION_EXPIRY", "24h")
	os.Setenv("AUTH_REMEMBER_ME_ENABLED", "true")
	os.Setenv("AUTH_REMEMBER_ME_TOKEN_LENGTH", "32")
	os.Setenv("AUTH_REMEMBER_ME_ROTATE_ON_USE", "true")
	os.Setenv("AUTH_PASSWORD_RESET_TOKEN_LENGTH", "32")
	os.Setenv("AUTH_PASSWORD_RESET_EXPIRY", "1h")
}

func enforceTOTPSettings() {
	os.Setenv("TOTP_ENABLED", "true")
}

func enforceJWTSettings() {
	os.Setenv("JWT_ALGORITHM", "HS256")
	os.Setenv("JWT_ACCESS_EXPIRY", "15m")
}

func enforceRefreshTokenSettings() {
	os.Setenv("REFRESH_TOKEN_TOKEN_LENGTH", "32")
	os.Setenv("REFRESH_TOKEN_EXPIRY", "720h")
	os.Setenv("REFRESH_TOKEN_ROTATION_MODE", "always")
}

func enforceJWTRevocationSettings() {
	os.Setenv("JWT_REVOCATION_ENABLED", "true")
	os.Setenv("JWT_REVOCATION_STORE", "memory")
}

func enforceRateLimitSettings() {
	os.Setenv("RATELIMIT_STORE", "memory")
}

func enforceCSRFSettings() {
	os.Setenv("CSRF_ENABLED", "true")
	os.Setenv("CSRF_TOKEN_LENGTH", "32")
	os.Setenv("CSRF_TOKEN_LOOKUP", "header:X-CSRF-Token")
	os.Setenv("CSRF_COOKIE_NAME", "_csrf")
	os.Setenv("CSRF_COOKIE_PATH", "/")
	os.Setenv("CSRF_COOKIE_MAX_AGE", "86400")
}
