package validation

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateStackName(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  error
	}{
		{"empty", "", ErrInvalidStackName},
		{"simple", "app", nil},
		{"alnum", "app123", nil},
		{"dots", "my.app", nil},
		{"underscores", "my_app", nil},
		{"hyphens", "my-app", nil},
		{"mixed", "My.App_1-2", nil},
		{"starts with dot", ".hidden", ErrInvalidCharacters},
		{"starts with underscore", "_hidden", ErrInvalidCharacters},
		{"starts with hyphen", "-name", ErrInvalidCharacters},
		{"space", "my app", ErrInvalidCharacters},
		{"slash", "my/app", ErrInvalidCharacters},
		{"backslash", "my\\app", ErrInvalidCharacters},
		{"colon", "my:app", ErrInvalidCharacters},
		{"dotdot fails regex", "..", ErrInvalidCharacters},
		{"dotdot in middle detected", "foo..bar", ErrPathTraversal},
		{"leading slash", "/absolute", ErrInvalidCharacters},
		{"single dot", ".", ErrInvalidCharacters},
		{"reserved con", "con", ErrReservedName},
		{"reserved CON case insensitive", "CON", ErrReservedName},
		{"reserved prn", "prn", ErrReservedName},
		{"reserved aux", "aux", ErrReservedName},
		{"reserved nul", "NUL", ErrReservedName},
		{"exactly max length", strings.Repeat("a", MaxStackNameLength), nil},
		{"too long", strings.Repeat("a", MaxStackNameLength+1), ErrStackNameTooLong},
		{"unicode rejected", "café", ErrInvalidCharacters},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ValidateStackName(tt.input)
			if !errors.Is(got, tt.want) {
				t.Errorf("ValidateStackName(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}
