package stack

import (
	"errors"

	agenttypes "github.com/tech-arch1tect/berth-agent/types"
)

type (
	RawComposeConfig = agenttypes.RawComposeConfig
	ComposeChanges   = agenttypes.ComposeChanges
	ServiceChanges   = agenttypes.ServiceChanges
	NewServiceConfig = agenttypes.NewServiceConfig

	ComposePortMapping       = agenttypes.PortMapping
	ComposeVolumeMount       = agenttypes.VolumeMount
	CommandConfig            = agenttypes.CommandConfig
	ComposeDependsOnConfig   = agenttypes.DependsOnConfig
	ComposeHealthcheckConfig = agenttypes.HealthcheckConfig
	ComposeServiceNetwork    = agenttypes.ServiceNetworkConfig

	ComposeDeployConfig        = agenttypes.DeployConfig
	ComposeResourcesConfig     = agenttypes.ResourcesConfig
	ComposeResourceLimits      = agenttypes.ResourceLimits
	ComposeRestartPolicyConfig = agenttypes.RestartPolicyConfig
	ComposePlacementConfig     = agenttypes.PlacementConfig
	ComposePlacementPreference = agenttypes.PlacementPreference
	ComposeUpdateRollback      = agenttypes.UpdateRollbackConfig
	ComposeBuildConfig         = agenttypes.BuildConfig

	ComposeNetworkConfig = agenttypes.NetworkConfig
	ComposeIpamConfig    = agenttypes.IpamConfig
	ComposeIpamPool      = agenttypes.IpamPool
	ComposeVolumeConfig  = agenttypes.VolumeConfig
	ComposeSecretConfig  = agenttypes.SecretConfig
	ComposeConfigConfig  = agenttypes.ConfigConfig

	UpdateComposeResponse = agenttypes.UpdateComposeResponse
)

var ErrUpdateComposeNoChanges = errors.New("at least one change is required")

type UpdateComposeRequest struct {
	agenttypes.UpdateComposeRequest
}

func (r *UpdateComposeRequest) Validate() error {
	c := &r.Changes
	if len(c.ServiceChanges) == 0 &&
		len(c.NetworkChanges) == 0 &&
		len(c.VolumeChanges) == 0 &&
		len(c.SecretChanges) == 0 &&
		len(c.ConfigChanges) == 0 &&
		len(c.AddServices) == 0 &&
		len(c.DeleteServices) == 0 &&
		len(c.RenameServices) == 0 {
		return ErrUpdateComposeNoChanges
	}
	return nil
}
