package maintenance

import "time"

type SystemInfo struct {
	Version       string `json:"version"`
	APIVersion    string `json:"api_version"`
	Architecture  string `json:"architecture"`
	OS            string `json:"os"`
	KernelVersion string `json:"kernel_version"`
	TotalMemory   int64  `json:"total_memory"`
	NCPU          int    `json:"ncpu"`
	StorageDriver string `json:"storage_driver"`
	DockerRootDir string `json:"docker_root_dir"`
	ServerVersion string `json:"server_version"`
}

type DiskUsage struct {
	LayersSize     int64 `json:"layers_size"`
	ImagesSize     int64 `json:"images_size"`
	ContainersSize int64 `json:"containers_size"`
	VolumesSize    int64 `json:"volumes_size"`
	BuildCacheSize int64 `json:"build_cache_size"`
	TotalSize      int64 `json:"total_size"`
}

type ImageInfo struct {
	Repository string    `json:"repository"`
	Tag        string    `json:"tag"`
	ID         string    `json:"id"`
	Size       int64     `json:"size"`
	Created    time.Time `json:"created"`
	Dangling   bool      `json:"dangling"`
	Unused     bool      `json:"unused"`
}

type ImageSummary struct {
	TotalCount    int         `json:"total_count"`
	DanglingCount int         `json:"dangling_count"`
	UnusedCount   int         `json:"unused_count"`
	TotalSize     int64       `json:"total_size"`
	DanglingSize  int64       `json:"dangling_size"`
	UnusedSize    int64       `json:"unused_size"`
	Images        []ImageInfo `json:"images"`
}

type ContainerInfo struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	State   string            `json:"state"`
	Status  string            `json:"status"`
	Created time.Time         `json:"created"`
	Size    int64             `json:"size"`
	Labels  map[string]string `json:"labels"`
}

type ContainerSummary struct {
	RunningCount int             `json:"running_count"`
	StoppedCount int             `json:"stopped_count"`
	TotalCount   int             `json:"total_count"`
	TotalSize    int64           `json:"total_size"`
	Containers   []ContainerInfo `json:"containers"`
}

type VolumeInfo struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Created    time.Time         `json:"created"`
	Size       int64             `json:"size"`
	Labels     map[string]string `json:"labels"`
	Unused     bool              `json:"unused"`
}

type VolumeSummary struct {
	TotalCount  int          `json:"total_count"`
	UnusedCount int          `json:"unused_count"`
	TotalSize   int64        `json:"total_size"`
	UnusedSize  int64        `json:"unused_size"`
	Volumes     []VolumeInfo `json:"volumes"`
}

type NetworkInfo struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Driver   string            `json:"driver"`
	Scope    string            `json:"scope"`
	Created  time.Time         `json:"created"`
	Internal bool              `json:"internal"`
	Labels   map[string]string `json:"labels"`
	Unused   bool              `json:"unused"`
	Subnet   string            `json:"subnet"`
}

type NetworkSummary struct {
	TotalCount  int           `json:"total_count"`
	UnusedCount int           `json:"unused_count"`
	Networks    []NetworkInfo `json:"networks"`
}

type BuildCacheInfo struct {
	ID          string    `json:"id"`
	Parent      string    `json:"parent,omitempty"`
	Type        string    `json:"type"`
	Size        int64     `json:"size"`
	Created     time.Time `json:"created"`
	LastUsed    time.Time `json:"last_used"`
	UsageCount  int       `json:"usage_count"`
	InUse       bool      `json:"in_use"`
	Shared      bool      `json:"shared"`
	Description string    `json:"description"`
}

type BuildCacheSummary struct {
	TotalCount int              `json:"total_count"`
	TotalSize  int64            `json:"total_size"`
	Cache      []BuildCacheInfo `json:"cache"`
}

type MaintenanceInfo struct {
	SystemInfo        SystemInfo        `json:"system_info"`
	DiskUsage         DiskUsage         `json:"disk_usage"`
	ImageSummary      ImageSummary      `json:"image_summary"`
	ContainerSummary  ContainerSummary  `json:"container_summary"`
	VolumeSummary     VolumeSummary     `json:"volume_summary"`
	NetworkSummary    NetworkSummary    `json:"network_summary"`
	BuildCacheSummary BuildCacheSummary `json:"build_cache_summary"`
	LastUpdated       time.Time         `json:"last_updated"`
}

type PruneRequest struct {
	Type    string `json:"type"`
	Force   bool   `json:"force"`
	All     bool   `json:"all"`
	Filters string `json:"filters"`
}

type DeleteRequest struct {
	Type string `json:"type"` // "image", "container", "volume", "network"
	ID   string `json:"id"`   // Resource ID to delete
}

type DeleteResult struct {
	Type    string `json:"type"`
	ID      string `json:"id"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type PruneResult struct {
	Type           string   `json:"type"`
	ItemsDeleted   []string `json:"items_deleted"`
	SpaceReclaimed int64    `json:"space_reclaimed"`
	Error          string   `json:"error,omitempty"`
}
