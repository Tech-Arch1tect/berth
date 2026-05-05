package security

import (
	"errors"
	"testing"
)

func TestListLogsRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     ListLogsRequest
		wantErr error
	}{
		{"page zero treated as default", ListLogsRequest{Page: 0, PerPage: 50}, nil},
		{"per_page one", ListLogsRequest{PerPage: 1}, nil},
		{"large per_page allowed", ListLogsRequest{PerPage: 5000}, nil},
		{"with filters", ListLogsRequest{EventType: "login", Page: 1, PerPage: 50}, nil},
		{"negative page rejected", ListLogsRequest{Page: -1, PerPage: 50}, ErrListLogsNegativePage},
		{"per_page zero rejected", ListLogsRequest{PerPage: 0}, ErrListLogsPerPageMin},
		{"negative per_page rejected", ListLogsRequest{PerPage: -5}, ErrListLogsPerPageMin},
		{"page checked before per_page", ListLogsRequest{Page: -1, PerPage: 0}, ErrListLogsNegativePage},
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
