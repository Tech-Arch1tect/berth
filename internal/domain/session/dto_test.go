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
	if err := (&RevokeAllOtherSessionsRequest{}).Validate(); err != nil {
		t.Errorf("Validate() = %v, want nil", err)
	}
}

func TestGetSessionsRequest_Validate(t *testing.T) {
	if err := (&GetSessionsRequest{}).Validate(); err != nil {
		t.Errorf("Validate() = %v, want nil", err)
	}
}
