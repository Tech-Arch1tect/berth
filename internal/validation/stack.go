package validation

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrInvalidStackName  = errors.New("invalid stack name")
	ErrStackNameTooLong  = errors.New("stack name must be 64 characters or less")
	ErrPathTraversal     = errors.New("path traversal detected")
	ErrInvalidCharacters = errors.New("stack name must start with a letter or number and can only contain letters, numbers, dots, underscores, and hyphens")
	ErrReservedName      = errors.New("stack name is reserved")
)

var ValidStackNameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)

const MaxStackNameLength = 64

func ValidateStackName(name string) error {
	if name == "" {
		return ErrInvalidStackName
	}

	if len(name) > MaxStackNameLength {
		return ErrStackNameTooLong
	}

	if !ValidStackNameRegex.MatchString(name) {
		return ErrInvalidCharacters
	}

	if strings.Contains(name, "..") {
		return ErrPathTraversal
	}

	if strings.HasPrefix(name, "/") {
		return ErrPathTraversal
	}

	reserved := []string{".", "..", "con", "prn", "aux", "nul"}
	for _, r := range reserved {
		if strings.EqualFold(name, r) {
			return ErrReservedName
		}
	}

	return nil
}
