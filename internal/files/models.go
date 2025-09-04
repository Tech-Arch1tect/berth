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
	Path     string `json:"path" validate:"required"`
	Content  string `json:"content"`
	Encoding string `json:"encoding,omitempty"`
}

type CreateDirectoryRequest struct {
	Path string `json:"path" validate:"required"`
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

type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}
