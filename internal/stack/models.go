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
	Name        string `json:"name"`
	Path        string `json:"path"`
	ComposeFile string `json:"compose_file"`
	ServerID    uint   `json:"server_id"`
	ServerName  string `json:"server_name"`
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
	Containers []Container `json:"containers"`
}

type Container struct {
	Name  string `json:"name"`
	Image string `json:"image"`
	State string `json:"state"`
	Ports []Port `json:"ports,omitempty"`
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
