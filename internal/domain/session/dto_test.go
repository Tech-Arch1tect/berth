package session

import (
	"errors"
	"testing"
)

func TestRevokeSessionRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     RevokeSessionRequest
		wantErr error
	}{
		{"zero id", RevokeSessionRequest{SessionID: 0}, ErrSessionIDRequired},
		{"present id", RevokeSessionRequest{SessionID: 7}, nil},
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

func TestRevokeAllOtherSessionsRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     RevokeAllOtherSessionsRequest
		wantErr error
	}{
		{"empty token", RevokeAllOtherSessionsRequest{RefreshToken: ""}, ErrSessionRefreshRequired},
		{"present token", RevokeAllOtherSessionsRequest{RefreshToken: "abc"}, nil},
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

func TestGetSessionsRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     GetSessionsRequest
		wantErr error
	}{
		{"empty token", GetSessionsRequest{RefreshToken: ""}, ErrSessionRefreshRequired},
		{"present token", GetSessionsRequest{RefreshToken: "abc"}, nil},
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
