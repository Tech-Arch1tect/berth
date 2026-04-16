package tokens

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const totpPendingTTL = 10 * time.Minute

func (s *Service) IssueAccessToken(userID uint) (string, error) {
	return s.signToken(userID, "", s.cfg.JWT.AccessExpiry)
}

func (s *Service) IssueTOTPPendingToken(userID uint) (string, error) {
	return s.signToken(userID, "totp_pending", totpPendingTTL)
}

func (s *Service) signToken(userID uint, tokenType string, ttl time.Duration) (string, error) {
	now := time.Now()
	jti := uuid.New().String()

	claims := Claims{
		UserID:    userID,
		TokenType: tokenType,
		JTI:       jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Issuer:    s.cfg.JWT.Issuer,
			Subject:   fmt.Sprintf("%d", userID),
			Audience:  []string{s.cfg.JWT.Issuer},
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.JWT.SecretKey))
	if err != nil {
		s.logger.Error("sign JWT failed", zap.Error(err), zap.Uint("user_id", userID))
		return "", fmt.Errorf("sign JWT: %w", err)
	}
	return signed, nil
}

func (s *Service) ValidateAccess(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok || t.Method.Alg() != "HS256" {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.JWT.SecretKey), nil
	})

	if err != nil {
		s.logger.Warn("JWT validation failed", zap.Error(err))
		switch {
		case errors.Is(err, jwt.ErrTokenExpired):
			return nil, ErrExpired
		case errors.Is(err, jwt.ErrTokenMalformed):
			return nil, ErrMalformed
		case errors.Is(err, jwt.ErrSignatureInvalid):
			return nil, ErrInvalidSignature
		default:
			return nil, ErrInvalid
		}
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalid
	}

	if s.revokeEnabled {
		revoked, err := s.isJTIRevoked(claims.JTI)
		if err != nil {
			s.logger.Error("JTI revocation check failed - denying access",
				zap.String("jti", claims.JTI), zap.Error(err))
			return nil, errors.New("token validation failed")
		}
		if revoked {
			return nil, ErrRevoked
		}
	}

	return claims, nil
}

func (s *Service) ExtractJTI(tokenString string) (string, error) {
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, &Claims{})
	if err != nil {
		return "", fmt.Errorf("parse token: %w", err)
	}
	if claims, ok := token.Claims.(*Claims); ok && claims.JTI != "" {
		return claims.JTI, nil
	}
	if reg, ok := token.Claims.(*jwt.RegisteredClaims); ok && reg.ID != "" {
		return reg.ID, nil
	}
	return "", errors.New("token missing JTI claim")
}
