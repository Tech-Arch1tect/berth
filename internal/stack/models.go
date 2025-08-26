package stack

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
