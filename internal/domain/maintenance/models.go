package maintenance

import "time"

type Amount struct {
	Count int   `json:"count"`
	Size  int64 `json:"size"`
}

type Removal string

const (
	RemovalNever   Removal = "never"
	RemovalWithAll Removal = "with_all"
	RemovalAlways  Removal = "always"
)

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
}

type ImageInfo struct {
	ID         string    `json:"id"`
	Tags       []string  `json:"tags"`
	Size       int64     `json:"size"`
	SharedSize int64     `json:"shared_size"`
	Created    time.Time `json:"created"`
	Containers int       `json:"containers"`
	Dangling   bool      `json:"dangling"`
	Unused     bool      `json:"unused"`
	Removal    Removal   `json:"removal"`
}

type ImageSummary struct {
	Total       Amount      `json:"total"`
	UnusedCount int         `json:"unused_count"`
	Images      []ImageInfo `json:"images"`
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
	Removal Removal           `json:"removal"`
}

type ContainerSummary struct {
	Total        Amount          `json:"total"`
	RunningCount int             `json:"running_count"`
	Containers   []ContainerInfo `json:"containers"`
}

type VolumeInfo struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Created    time.Time         `json:"created"`
	Size       int64             `json:"size"`
	Labels     map[string]string `json:"labels"`
	Anonymous  bool              `json:"anonymous"`
	Unused     bool              `json:"unused"`
	Removal    Removal           `json:"removal"`
}

type VolumeSummary struct {
	Total   Amount       `json:"total"`
	Unused  Amount       `json:"unused"`
	Volumes []VolumeInfo `json:"volumes"`
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
	Removal  Removal           `json:"removal"`
}

type NetworkSummary struct {
	TotalCount  int           `json:"total_count"`
	UnusedCount int           `json:"unused_count"`
	Networks    []NetworkInfo `json:"networks"`
}

type BuildCacheInfo struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"`
	Description string     `json:"description"`
	Size        int64      `json:"size"`
	Created     time.Time  `json:"created"`
	LastUsed    *time.Time `json:"last_used"`
	UsageCount  int        `json:"usage_count"`
	InUse       bool       `json:"in_use"`
	Shared      bool       `json:"shared"`
	Removal     Removal    `json:"removal"`
}

type BuildCacheSummary struct {
	Total Amount           `json:"total"`
	Cache []BuildCacheInfo `json:"cache"`
}

type MaintenanceInfo struct {
	SystemInfo          SystemInfo        `json:"system_info"`
	ImageSummary        ImageSummary      `json:"image_summary"`
	ContainerSummary    ContainerSummary  `json:"container_summary"`
	VolumeSummary       VolumeSummary     `json:"volume_summary"`
	NetworkSummary      NetworkSummary    `json:"network_summary"`
	BuildCacheSummary   BuildCacheSummary `json:"build_cache_summary"`
	SystemCleanupCovers []string          `json:"system_cleanup_covers"`
	LastUpdated         time.Time         `json:"last_updated"`
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
