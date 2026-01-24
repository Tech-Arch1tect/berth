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
	Path     string  `json:"path" validate:"required"`
	Content  string  `json:"content"`
	Encoding string  `json:"encoding,omitempty"`
	Mode     *string `json:"mode,omitempty"`
	OwnerID  *uint32 `json:"owner_id,omitempty"`
	GroupID  *uint32 `json:"group_id,omitempty"`
}

type CreateDirectoryRequest struct {
	Path    string  `json:"path" validate:"required"`
	Mode    *string `json:"mode,omitempty"`
	OwnerID *uint32 `json:"owner_id,omitempty"`
	GroupID *uint32 `json:"group_id,omitempty"`
}

type DeleteRequest struct {
	Path string `json:"path" validate:"required"`
}

type RenameRequest struct {
	OldPath string `json:"old_path" validate:"required"`
	NewPath string `json:"new_path" validate:"required"`
}

type CopyRequest struct {
	SourcePath string `json:"source_path" validate:"required"`
	TargetPath string `json:"target_path" validate:"required"`
}

type ChmodRequest struct {
	Path      string `json:"path" validate:"required"`
	Mode      string `json:"mode" validate:"required"`
	Recursive bool   `json:"recursive,omitempty"`
}

type ChownRequest struct {
	Path      string  `json:"path" validate:"required"`
	OwnerID   *uint32 `json:"owner_id,omitempty"`
	GroupID   *uint32 `json:"group_id,omitempty"`
	Recursive bool    `json:"recursive,omitempty"`
}

type DirectoryStatsRequest struct {
	Path string `json:"path" validate:"required"`
}

type DirectoryStats struct {
	Path            string `json:"path"`
	MostCommonOwner uint32 `json:"most_common_owner"`
	MostCommonGroup uint32 `json:"most_common_group"`
	MostCommonMode  string `json:"most_common_mode"`
	OwnerName       string `json:"owner_name,omitempty"`
	GroupName       string `json:"group_name,omitempty"`
}

type MessageResponse struct {
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}
