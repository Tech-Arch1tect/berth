package files

import "errors"

var (
	ErrFilePathRequired        = errors.New("path is required")
	ErrFileRenamePathsRequired = errors.New("oldPath and newPath are required")
	ErrFileCopyPathsRequired   = errors.New("sourcePath and targetPath are required")
	ErrFileChmodModeRequired   = errors.New("mode is required")
	ErrFileChownIDRequired     = errors.New("owner_id or group_id is required")
)

type WriteFileRequest struct {
	Path     string  `json:"path"`
	Content  string  `json:"content"`
	Encoding string  `json:"encoding,omitempty"`
	Mode     *string `json:"mode,omitempty"`
	OwnerID  *uint32 `json:"owner_id,omitempty"`
	GroupID  *uint32 `json:"group_id,omitempty"`
}

func (r *WriteFileRequest) Validate() error {
	if r.Path == "" {
		return ErrFilePathRequired
	}
	return nil
}

type CreateDirectoryRequest struct {
	Path    string  `json:"path"`
	Mode    *string `json:"mode,omitempty"`
	OwnerID *uint32 `json:"owner_id,omitempty"`
	GroupID *uint32 `json:"group_id,omitempty"`
}

func (r *CreateDirectoryRequest) Validate() error {
	if r.Path == "" {
		return ErrFilePathRequired
	}
	return nil
}

type DeleteRequest struct {
	Path string `json:"path"`
}

func (r *DeleteRequest) Validate() error {
	if r.Path == "" {
		return ErrFilePathRequired
	}
	return nil
}

type RenameRequest struct {
	OldPath string `json:"old_path"`
	NewPath string `json:"new_path"`
}

func (r *RenameRequest) Validate() error {
	if r.OldPath == "" || r.NewPath == "" {
		return ErrFileRenamePathsRequired
	}
	return nil
}

type CopyRequest struct {
	SourcePath string `json:"source_path"`
	TargetPath string `json:"target_path"`
}

func (r *CopyRequest) Validate() error {
	if r.SourcePath == "" || r.TargetPath == "" {
		return ErrFileCopyPathsRequired
	}
	return nil
}

type ChmodRequest struct {
	Path      string `json:"path"`
	Mode      string `json:"mode"`
	Recursive bool   `json:"recursive,omitempty"`
}

func (r *ChmodRequest) Validate() error {
	if r.Path == "" {
		return ErrFilePathRequired
	}
	if r.Mode == "" {
		return ErrFileChmodModeRequired
	}
	return nil
}

type ChownRequest struct {
	Path      string  `json:"path"`
	OwnerID   *uint32 `json:"owner_id,omitempty"`
	GroupID   *uint32 `json:"group_id,omitempty"`
	Recursive bool    `json:"recursive,omitempty"`
}

func (r *ChownRequest) Validate() error {
	if r.Path == "" {
		return ErrFilePathRequired
	}
	if r.OwnerID == nil && r.GroupID == nil {
		return ErrFileChownIDRequired
	}
	return nil
}
