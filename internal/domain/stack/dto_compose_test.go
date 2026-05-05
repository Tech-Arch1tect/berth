package stack

import (
	"errors"
	"testing"

	agenttypes "github.com/tech-arch1tect/berth-agent/types"
)

func TestUpdateComposeRequest_Validate(t *testing.T) {
	withChanges := func(mutate func(c *agenttypes.ComposeChanges)) UpdateComposeRequest {
		req := UpdateComposeRequest{}
		mutate(&req.Changes)
		return req
	}

	tests := []struct {
		name    string
		req     UpdateComposeRequest
		wantErr error
	}{
		{"empty changes rejected", UpdateComposeRequest{}, ErrUpdateComposeNoChanges},
		{"empty changes with preview also rejected", UpdateComposeRequest{
			UpdateComposeRequest: agenttypes.UpdateComposeRequest{Preview: true},
		}, ErrUpdateComposeNoChanges},
		{"service changes", withChanges(func(c *agenttypes.ComposeChanges) {
			c.ServiceChanges = map[string]agenttypes.ServiceChanges{"web": {}}
		}), nil},
		{"network changes", withChanges(func(c *agenttypes.ComposeChanges) {
			c.NetworkChanges = map[string]*agenttypes.NetworkConfig{"net": {}}
		}), nil},
		{"volume changes", withChanges(func(c *agenttypes.ComposeChanges) {
			c.VolumeChanges = map[string]*agenttypes.VolumeConfig{"vol": {}}
		}), nil},
		{"secret changes", withChanges(func(c *agenttypes.ComposeChanges) {
			c.SecretChanges = map[string]*agenttypes.SecretConfig{"sec": {}}
		}), nil},
		{"config changes", withChanges(func(c *agenttypes.ComposeChanges) {
			c.ConfigChanges = map[string]*agenttypes.ConfigConfig{"cfg": {}}
		}), nil},
		{"add services", withChanges(func(c *agenttypes.ComposeChanges) {
			c.AddServices = map[string]agenttypes.NewServiceConfig{"new": {Image: "alpine"}}
		}), nil},
		{"delete services", withChanges(func(c *agenttypes.ComposeChanges) {
			c.DeleteServices = []string{"old"}
		}), nil},
		{"rename services", withChanges(func(c *agenttypes.ComposeChanges) {
			c.RenameServices = map[string]string{"old": "new"}
		}), nil},
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
