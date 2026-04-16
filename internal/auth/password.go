package auth

import (
	"fmt"
	"strings"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

func (s *Service) ValidatePassword(password string) error {
	if len(password) < s.config.Auth.MinLength {
		return fmt.Errorf("password must be at least %d characters", s.config.Auth.MinLength)
	}

	var hasUpper, hasLower, hasNumber, hasSpecial bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsNumber(c):
			hasNumber = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}

	var missing []string
	if s.config.Auth.RequireUpper && !hasUpper {
		missing = append(missing, "one uppercase letter")
	}
	if s.config.Auth.RequireLower && !hasLower {
		missing = append(missing, "one lowercase letter")
	}
	if s.config.Auth.RequireNumber && !hasNumber {
		missing = append(missing, "one number")
	}
	if s.config.Auth.RequireSpecial && !hasSpecial {
		missing = append(missing, "one special character")
	}
	if len(missing) > 0 {
		return fmt.Errorf("password must contain at least %s", strings.Join(missing, ", "))
	}
	return nil
}

func (s *Service) HashPassword(password string) (string, error) {
	if err := s.ValidatePassword(password); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), s.config.Auth.BcryptCost)
	if err != nil {
		return "", ErrPasswordHashingFailed
	}
	return string(hash), nil
}

func (s *Service) VerifyPassword(hashedPassword, password string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
		return ErrInvalidCredentials
	}
	return nil
}
