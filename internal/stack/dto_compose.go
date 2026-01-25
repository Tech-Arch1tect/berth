package stack

import agenttypes "github.com/tech-arch1tect/berth-agent/types"

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

	UpdateComposeRequest  = agenttypes.UpdateComposeRequest
	UpdateComposeResponse = agenttypes.UpdateComposeResponse
)
