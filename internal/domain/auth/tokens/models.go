package tokens

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

var (
	ErrInvalid          = errors.New("invalid JWT token")
	ErrExpired          = errors.New("JWT token has expired")
	ErrMalformed        = errors.New("malformed JWT token")
	ErrInvalidSignature = errors.New("invalid JWT token signature")
	ErrRevoked          = errors.New("JWT token has been revoked")

	ErrRefreshNotFound = errors.New("refresh token not found")
	ErrRefreshExpired  = errors.New("refresh token expired")
	ErrRefreshInvalid  = errors.New("invalid refresh token")
)

type Claims struct {
	UserID    uint   `json:"user_id"`
	TokenType string `json:"token_type,omitempty"`
	JTI       string `json:"jti"`
	jwt.RegisteredClaims
}

type SessionInfo struct {
	IPAddress  string
	UserAgent  string
	DeviceInfo map[string]any
}

type RefreshTokenData struct {
	Token     string
	TokenID   uint
	Hash      string
	ExpiresAt time.Time
}

type RotationResult struct {
	AccessToken    string
	RefreshToken   string
	RefreshTokenID uint
	OldTokenID     uint
	ExpiresAt      time.Time
}

type RevokedToken struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
	JTI       string         `json:"jti" gorm:"uniqueIndex;size:50;not null"`
	ExpiresAt time.Time      `json:"expires_at" gorm:"not null"`
}
