package files

import (
	"time"
)

type FileEntry struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Size        int64     `json:"size"`
	IsDirectory bool      `json:"is_directory"`
	ModTime     time.Time `json:"mod_time"`
	Mode        string    `json:"mode"`
	Owner       string    `json:"owner,omitempty"`
	Group       string    `json:"group,omitempty"`
	OwnerID     uint32    `json:"owner_id,omitempty"`
	GroupID     uint32    `json:"group_id,omitempty"`
	Extension   string    `json:"extension,omitempty"`
}

type DirectoryListing struct {
	Path    string      `json:"path"`
	Entries []FileEntry `json:"entries"`
}

type FileContent struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Size     int64  `json:"size"`
	Encoding string `json:"encoding"`
}

type WriteFileRequest struct {
	Path     string  `json:"path"`
	Content  string  `json:"content"`
	Encoding string  `json:"encoding,omitempty"`
	Mode     *string `json:"mode,omitempty"`
	OwnerID  *uint32 `json:"owner_id,omitempty"`
	GroupID  *uint32 `json:"group_id,omitempty"`
}

type CreateDirectoryRequest struct {
	Path    string  `json:"path"`
	Mode    *string `json:"mode,omitempty"`
	OwnerID *uint32 `json:"owner_id,omitempty"`
	GroupID *uint32 `json:"group_id,omitempty"`
}

type DeleteRequest struct {
	Path string `json:"path"`
}

type RenameRequest struct {
	OldPath string `json:"old_path"`
	NewPath string `json:"new_path"`
}

type CopyRequest struct {
	SourcePath string `json:"source_path"`
	TargetPath string `json:"target_path"`
}

type ChmodRequest struct {
	Path      string `json:"path"`
	Mode      string `json:"mode"`
	Recursive bool   `json:"recursive,omitempty"`
}

type ChownRequest struct {
	Path      string  `json:"path"`
	OwnerID   *uint32 `json:"owner_id,omitempty"`
	GroupID   *uint32 `json:"group_id,omitempty"`
	Recursive bool    `json:"recursive,omitempty"`
}

type DirectoryStatsRequest struct {
	Path string `json:"path"`
}

type DirectoryStats struct {
	Path            string `json:"path"`
	MostCommonOwner uint32 `json:"most_common_owner"`
	MostCommonGroup uint32 `json:"most_common_group"`
	MostCommonMode  string `json:"most_common_mode"`
	OwnerName       string `json:"owner_name,omitempty"`
	GroupName       string `json:"group_name,omitempty"`
}

type FileMessageData struct {
	Message string `json:"message"`
}
