package stack

type ContainerStats struct {
	Name             string  `json:"name"`
	ServiceName      string  `json:"service_name"`
	CPUPercent       float64 `json:"cpu_percent"`
	CPUUserTime      uint64  `json:"cpu_user_time"`
	CPUSystemTime    uint64  `json:"cpu_system_time"`
	MemoryUsage      uint64  `json:"memory_usage"`
	MemoryLimit      uint64  `json:"memory_limit"`
	MemoryPercent    float64 `json:"memory_percent"`
	MemoryRSS        uint64  `json:"memory_rss"`
	MemoryCache      uint64  `json:"memory_cache"`
	MemorySwap       uint64  `json:"memory_swap"`
	PageFaults       uint64  `json:"page_faults"`
	PageMajorFaults  uint64  `json:"page_major_faults"`
	NetworkRxBytes   uint64  `json:"network_rx_bytes"`
	NetworkTxBytes   uint64  `json:"network_tx_bytes"`
	NetworkRxPackets uint64  `json:"network_rx_packets"`
	NetworkTxPackets uint64  `json:"network_tx_packets"`
	BlockReadBytes   uint64  `json:"block_read_bytes"`
	BlockWriteBytes  uint64  `json:"block_write_bytes"`
	BlockReadOps     uint64  `json:"block_read_ops"`
	BlockWriteOps    uint64  `json:"block_write_ops"`
}

type StackStats struct {
	StackName  string           `json:"stack_name"`
	Containers []ContainerStats `json:"containers"`
}

type Stack struct {
	Name              string `json:"name"`
	Path              string `json:"path"`
	ComposeFile       string `json:"compose_file"`
	ServerID          uint   `json:"server_id"`
	ServerName        string `json:"server_name"`
	IsHealthy         bool   `json:"is_healthy"`
	TotalContainers   int    `json:"total_containers"`
	RunningContainers int    `json:"running_containers"`
}

type StackDetails struct {
	Name        string           `json:"name"`
	Path        string           `json:"path"`
	ComposeFile string           `json:"compose_file"`
	Services    []ComposeService `json:"services"`
	ServerID    uint             `json:"server_id"`
	ServerName  string           `json:"server_name"`
}

type ComposeService struct {
	Name       string      `json:"name"`
	Image      string      `json:"image,omitempty"`
	Ports      []string    `json:"ports,omitempty"`
	Containers []Container `json:"containers"`
}

type Container struct {
	Name           string             `json:"name"`
	Image          string             `json:"image"`
	State          string             `json:"state"`
	Ports          []Port             `json:"ports,omitempty"`
	Created        string             `json:"created,omitempty"`
	Started        string             `json:"started,omitempty"`
	Finished       string             `json:"finished,omitempty"`
	ExitCode       *int               `json:"exit_code,omitempty"`
	RestartPolicy  *RestartPolicy     `json:"restart_policy,omitempty"`
	ResourceLimits *ResourceLimits    `json:"resource_limits,omitempty"`
	Health         *HealthStatus      `json:"health,omitempty"`
	Command        []string           `json:"command,omitempty"`
	WorkingDir     string             `json:"working_dir,omitempty"`
	User           string             `json:"user,omitempty"`
	Labels         map[string]string  `json:"labels,omitempty"`
	Networks       []ContainerNetwork `json:"networks,omitempty"`
	Mounts         []ContainerMount   `json:"mounts,omitempty"`
}

type ContainerNetwork struct {
	Name       string   `json:"name"`
	NetworkID  string   `json:"network_id,omitempty"`
	IPAddress  string   `json:"ip_address,omitempty"`
	Gateway    string   `json:"gateway,omitempty"`
	MacAddress string   `json:"mac_address,omitempty"`
	Aliases    []string `json:"aliases,omitempty"`
}

type ContainerMount struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Driver      string `json:"driver,omitempty"`
	Mode        string `json:"mode,omitempty"`
	RW          bool   `json:"rw"`
	Propagation string `json:"propagation,omitempty"`
}

type RestartPolicy struct {
	Name              string `json:"name"`
	MaximumRetryCount int    `json:"maximum_retry_count,omitempty"`
}

type ResourceLimits struct {
	CPUShares  int64 `json:"cpu_shares,omitempty"`
	Memory     int64 `json:"memory,omitempty"`
	MemorySwap int64 `json:"memory_swap,omitempty"`
	CPUQuota   int64 `json:"cpu_quota,omitempty"`
	CPUPeriod  int64 `json:"cpu_period,omitempty"`
}

type HealthStatus struct {
	Status        string      `json:"status"`
	FailingStreak int         `json:"failing_streak,omitempty"`
	Log           []HealthLog `json:"log,omitempty"`
}

type HealthLog struct {
	Start    string `json:"start"`
	End      string `json:"end,omitempty"`
	ExitCode int    `json:"exit_code"`
	Output   string `json:"output"`
}

type Port struct {
	Private int    `json:"private"`
	Public  int    `json:"public,omitempty"`
	Type    string `json:"type"`
}

type NetworkIPAMConfig struct {
	Subnet  string `json:"subnet,omitempty"`
	Gateway string `json:"gateway,omitempty"`
}

type NetworkIPAM struct {
	Driver string              `json:"driver,omitempty"`
	Config []NetworkIPAMConfig `json:"config,omitempty"`
}

type NetworkEndpoint struct {
	Name        string `json:"name"`
	EndpointID  string `json:"endpoint_id,omitempty"`
	MacAddress  string `json:"mac_address,omitempty"`
	IPv4Address string `json:"ipv4_address,omitempty"`
	IPv6Address string `json:"ipv6_address,omitempty"`
}

type Network struct {
	Name       string                     `json:"name"`
	Driver     string                     `json:"driver,omitempty"`
	External   bool                       `json:"external,omitempty"`
	Labels     map[string]string          `json:"labels,omitempty"`
	Options    map[string]string          `json:"options,omitempty"`
	IPAM       *NetworkIPAM               `json:"ipam,omitempty"`
	Containers map[string]NetworkEndpoint `json:"containers,omitempty"`
	Exists     bool                       `json:"exists"`
	Created    string                     `json:"created,omitempty"`
}

type VolumeMount struct {
	Type         string            `json:"type"`
	Source       string            `json:"source"`
	Target       string            `json:"target"`
	ReadOnly     bool              `json:"read_only,omitempty"`
	BindOptions  map[string]string `json:"bind_options,omitempty"`
	TmpfsOptions map[string]string `json:"tmpfs_options,omitempty"`
}

type VolumeUsage struct {
	ContainerName string        `json:"container_name"`
	ServiceName   string        `json:"service_name"`
	Mounts        []VolumeMount `json:"mounts"`
}

type Volume struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver,omitempty"`
	External   bool              `json:"external,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
	DriverOpts map[string]string `json:"driver_opts,omitempty"`
	Exists     bool              `json:"exists"`
	Created    string            `json:"created,omitempty"`
	Mountpoint string            `json:"mountpoint,omitempty"`
	Scope      string            `json:"scope,omitempty"`
	UsedBy     []VolumeUsage     `json:"used_by,omitempty"`
}

type ContainerImageDetails struct {
	ContainerName string              `json:"container_name"`
	ImageID       string              `json:"image_id"`
	ImageName     string              `json:"image_name"`
	ImageInfo     ImageInspectInfo    `json:"image_info"`
	ImageHistory  []ImageHistoryLayer `json:"image_history"`
}

type ImageInspectInfo struct {
	Architecture  string      `json:"architecture"`
	OS            string      `json:"os"`
	Size          int64       `json:"size"`
	VirtualSize   int64       `json:"virtual_size"`
	Author        string      `json:"author"`
	Created       string      `json:"created"`
	DockerVersion string      `json:"docker_version"`
	Config        ImageConfig `json:"config"`
	RootFS        RootFS      `json:"rootfs"`
	Parent        string      `json:"parent,omitempty"`
	RepoTags      []string    `json:"repo_tags,omitempty"`
	RepoDigests   []string    `json:"repo_digests,omitempty"`
}

type ImageConfig struct {
	User         string              `json:"user,omitempty"`
	Env          []string            `json:"env,omitempty"`
	Cmd          []string            `json:"cmd,omitempty"`
	Entrypoint   []string            `json:"entrypoint,omitempty"`
	WorkingDir   string              `json:"working_dir,omitempty"`
	ExposedPorts map[string]struct{} `json:"exposed_ports,omitempty"`
	Labels       map[string]string   `json:"labels,omitempty"`
}

type RootFS struct {
	Type   string   `json:"type"`
	Layers []string `json:"layers,omitempty"`
}

type ImageHistoryLayer struct {
	ID        string   `json:"id"`
	Created   int64    `json:"created"`
	CreatedBy string   `json:"created_by"`
	Size      int64    `json:"size"`
	Comment   string   `json:"comment,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}

type EnvironmentVariable struct {
	Key             string `json:"key"`
	Value           string `json:"value"`
	IsSensitive     bool   `json:"is_sensitive"`
	Source          string `json:"source"`
	IsFromContainer bool   `json:"is_from_container"`
}

type ServiceEnvironment struct {
	ServiceName string                `json:"service_name,omitempty"`
	Variables   []EnvironmentVariable `json:"variables"`
}

type CreateStackRequest struct {
	Name string `json:"name"`
}

type ListStacksResponse struct {
	Stacks []Stack `json:"stacks"`
}

type StackPermissionsResponse struct {
	Permissions []string `json:"permissions"`
}

type StackNetworksResponse struct {
	Networks []Network `json:"networks"`
}

type StackVolumesResponse struct {
	Volumes []Volume `json:"volumes"`
}

type StackEnvironmentResponse map[string][]ServiceEnvironment

type StackImagesResponse struct {
	Images []ContainerImageDetails `json:"images"`
}

type StackStatsResponse struct {
	StackStats
}

type CanCreateStackResponse struct {
	CanCreate bool `json:"canCreate"`
}

type CreateStackResponse struct {
	Stack   *Stack `json:"stack"`
	Message string `json:"message"`
}
