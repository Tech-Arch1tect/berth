package rbac

import (
	"errors"
	"testing"
)

func TestCreateUserRequest_Validate(t *testing.T) {
	full := CreateUserRequest{
		Username:        "alice",
		Email:           "alice@example.com",
		Password:        "password123",
		PasswordConfirm: "password123",
	}

	tests := []struct {
		name    string
		mutate  func(r *CreateUserRequest)
		wantErr error
	}{
		{"all present", func(r *CreateUserRequest) {}, nil},
		{"empty username", func(r *CreateUserRequest) { r.Username = "" }, ErrCreateUserFieldsRequired},
		{"empty email", func(r *CreateUserRequest) { r.Email = "" }, ErrCreateUserFieldsRequired},
		{"empty password", func(r *CreateUserRequest) { r.Password = "" }, ErrCreateUserFieldsRequired},
		{"all empty", func(r *CreateUserRequest) { *r = CreateUserRequest{} }, ErrCreateUserFieldsRequired},
		{"password mismatch", func(r *CreateUserRequest) { r.PasswordConfirm = "different" }, ErrCreateUserPasswordMismatch},
		{"empty confirm", func(r *CreateUserRequest) { r.PasswordConfirm = "" }, ErrCreateUserPasswordMismatch},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := full
			tt.mutate(&req)
			got := req.Validate()
			if !errors.Is(got, tt.wantErr) {
				t.Errorf("Validate() = %v, want %v", got, tt.wantErr)
			}
		})
	}
}

func TestCreateRoleRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     CreateRoleRequest
		wantErr error
	}{
		{"empty name", CreateRoleRequest{Name: ""}, ErrRoleNameRequired},
		{"present name", CreateRoleRequest{Name: "admin"}, nil},
		{"description optional", CreateRoleRequest{Name: "admin", Description: ""}, nil},
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

func TestUpdateRoleRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     UpdateRoleRequest
		wantErr error
	}{
		{"empty name", UpdateRoleRequest{Name: ""}, ErrRoleNameRequired},
		{"present name", UpdateRoleRequest{Name: "admin"}, nil},
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

func TestCreateStackPermissionRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     CreateStackPermissionRequest
		wantErr error
	}{
		{"both ids zero", CreateStackPermissionRequest{ServerID: 0, PermissionID: 0}, ErrStackPermissionFieldsRequired},
		{"server zero", CreateStackPermissionRequest{ServerID: 0, PermissionID: 2}, ErrStackPermissionFieldsRequired},
		{"permission zero", CreateStackPermissionRequest{ServerID: 1, PermissionID: 0}, ErrStackPermissionFieldsRequired},
		{"both present", CreateStackPermissionRequest{ServerID: 1, PermissionID: 2}, nil},
		{"stack_pattern optional", CreateStackPermissionRequest{ServerID: 1, PermissionID: 2, StackPattern: ""}, nil},
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
