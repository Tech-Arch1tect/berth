package config

import "os"

func EnforceRequiredSettings() {
	enforceDatabaseSettings()
	enforceAuthSettings()
	enforceTOTPSettings()
	enforceJWTSettings()
	enforceRefreshTokenSettings()
	enforceJWTRevocationSettings()
}

func enforceDatabaseSettings() {
	os.Setenv("DATABASE_AUTO_MIGRATE", "true")
}

func enforceAuthSettings() {
	os.Setenv("AUTH_EMAIL_VERIFICATION_TOKEN_LENGTH", "32")
	os.Setenv("AUTH_EMAIL_VERIFICATION_EXPIRY", "24h")
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
}

func enforceJWTRevocationSettings() {
	os.Setenv("JWT_REVOCATION_ENABLED", "true")
	os.Setenv("JWT_REVOCATION_STORE", "memory")
}
