package apikey

import (
	"errors"
	"strings"
	"testing"
)

func strptr(s string) *string { return &s }

func TestCreateAPIKeyRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     CreateAPIKeyRequest
		wantErr error
	}{
		{"empty name", CreateAPIKeyRequest{Name: ""}, ErrAPIKeyNameRequired},
		{"single char name", CreateAPIKeyRequest{Name: "x"}, nil},
		{"exactly 255 char name", CreateAPIKeyRequest{Name: strings.Repeat("a", 255)}, nil},
		{"256 char name", CreateAPIKeyRequest{Name: strings.Repeat("a", 256)}, ErrAPIKeyNameTooLong},
		{"name with optional expires", CreateAPIKeyRequest{Name: "ok", ExpiresAt: strptr("2030-01-01T00:00:00Z")}, nil},
		{"name with empty expires string", CreateAPIKeyRequest{Name: "ok", ExpiresAt: strptr("")}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestAddScopeRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     AddScopeRequest
		wantErr error
	}{
		{"empty pattern", AddScopeRequest{StackPattern: "", Permission: "stacks.read"}, ErrScopeStackPatternRequired},
		{"empty permission", AddScopeRequest{StackPattern: "test-*", Permission: ""}, ErrScopePermissionRequired},
		{"both required ok", AddScopeRequest{StackPattern: "test-*", Permission: "stacks.read"}, nil},
		{"alphanumeric pattern", AddScopeRequest{StackPattern: "App123", Permission: "stacks.read"}, nil},
		{"underscore dash dot star pattern", AddScopeRequest{StackPattern: "a-b_c.d*", Permission: "stacks.read"}, nil},
		{"space in pattern rejected", AddScopeRequest{StackPattern: "bad pattern", Permission: "stacks.read"}, ErrScopeStackPatternInvalidChars},
		{"slash in pattern rejected", AddScopeRequest{StackPattern: "bad/pattern", Permission: "stacks.read"}, ErrScopeStackPatternInvalidChars},
		{"colon in pattern rejected", AddScopeRequest{StackPattern: "bad:pattern", Permission: "stacks.read"}, ErrScopeStackPatternInvalidChars},
		{"exactly 255 char pattern", AddScopeRequest{StackPattern: strings.Repeat("a", 255), Permission: "stacks.read"}, nil},
		{"256 char pattern", AddScopeRequest{StackPattern: strings.Repeat("a", 256), Permission: "stacks.read"}, ErrScopeStackPatternTooLong},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}
