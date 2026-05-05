package maintenance

import (
	"errors"
	"testing"
)

func TestPruneRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     PruneRequest
		wantErr error
	}{
		{"empty type", PruneRequest{Type: ""}, ErrPruneTypeRequired},
		{"unknown type", PruneRequest{Type: "bogus"}, ErrPruneTypeInvalid},
		{"images", PruneRequest{Type: "images"}, nil},
		{"containers", PruneRequest{Type: "containers"}, nil},
		{"volumes", PruneRequest{Type: "volumes"}, nil},
		{"networks", PruneRequest{Type: "networks"}, nil},
		{"build-cache", PruneRequest{Type: "build-cache"}, nil},
		{"system", PruneRequest{Type: "system"}, nil},
		{"flags ignored on validation", PruneRequest{Type: "images", Force: true, All: true, Filters: "x"}, nil},
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

func TestDeleteRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     DeleteRequest
		wantErr error
	}{
		{"empty type", DeleteRequest{Type: "", ID: "abc"}, ErrDeleteTypeRequired},
		{"empty id", DeleteRequest{Type: "image", ID: ""}, ErrDeleteIDRequired},
		{"unknown type", DeleteRequest{Type: "bogus", ID: "abc"}, ErrDeleteTypeInvalid},
		{"image", DeleteRequest{Type: "image", ID: "abc"}, nil},
		{"container", DeleteRequest{Type: "container", ID: "abc"}, nil},
		{"volume", DeleteRequest{Type: "volume", ID: "abc"}, nil},
		{"network", DeleteRequest{Type: "network", ID: "abc"}, nil},
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
