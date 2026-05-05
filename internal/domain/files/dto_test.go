package files

import (
	"errors"
	"testing"
)

func u32ptr(v uint32) *uint32 { return &v }

func TestWriteFileRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     WriteFileRequest
		wantErr error
	}{
		{"empty path", WriteFileRequest{Path: ""}, ErrFilePathRequired},
		{"present path", WriteFileRequest{Path: "/etc/foo"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestCreateDirectoryRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     CreateDirectoryRequest
		wantErr error
	}{
		{"empty path", CreateDirectoryRequest{Path: ""}, ErrFilePathRequired},
		{"present path", CreateDirectoryRequest{Path: "/srv/x"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestDeleteRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     DeleteRequest
		wantErr error
	}{
		{"empty path", DeleteRequest{Path: ""}, ErrFilePathRequired},
		{"present path", DeleteRequest{Path: "/x"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestRenameRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     RenameRequest
		wantErr error
	}{
		{"both empty", RenameRequest{}, ErrFileRenamePathsRequired},
		{"empty old", RenameRequest{OldPath: "", NewPath: "/b"}, ErrFileRenamePathsRequired},
		{"empty new", RenameRequest{OldPath: "/a", NewPath: ""}, ErrFileRenamePathsRequired},
		{"both present", RenameRequest{OldPath: "/a", NewPath: "/b"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestCopyRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     CopyRequest
		wantErr error
	}{
		{"both empty", CopyRequest{}, ErrFileCopyPathsRequired},
		{"empty source", CopyRequest{SourcePath: "", TargetPath: "/b"}, ErrFileCopyPathsRequired},
		{"empty target", CopyRequest{SourcePath: "/a", TargetPath: ""}, ErrFileCopyPathsRequired},
		{"both present", CopyRequest{SourcePath: "/a", TargetPath: "/b"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestChmodRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     ChmodRequest
		wantErr error
	}{
		{"empty path", ChmodRequest{Path: "", Mode: "0644"}, ErrFilePathRequired},
		{"empty mode", ChmodRequest{Path: "/x", Mode: ""}, ErrFileChmodModeRequired},
		{"both empty - path checked first", ChmodRequest{}, ErrFilePathRequired},
		{"both present", ChmodRequest{Path: "/x", Mode: "0644"}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestChownRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     ChownRequest
		wantErr error
	}{
		{"empty path", ChownRequest{Path: "", OwnerID: u32ptr(1)}, ErrFilePathRequired},
		{"path only, no ids", ChownRequest{Path: "/x"}, ErrFileChownIDRequired},
		{"path + owner", ChownRequest{Path: "/x", OwnerID: u32ptr(1)}, nil},
		{"path + group", ChownRequest{Path: "/x", GroupID: u32ptr(2)}, nil},
		{"path + both", ChownRequest{Path: "/x", OwnerID: u32ptr(1), GroupID: u32ptr(2)}, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}
