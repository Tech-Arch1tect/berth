package models

import (
	"gorm.io/gorm"
)

type ServerRolePermission struct {
	gorm.Model
	ServerID     uint       `json:"server_id" gorm:"not null"`
	RoleID       uint       `json:"role_id" gorm:"not null"`
	PermissionID uint       `json:"permission_id" gorm:"not null"`
	Server       Server     `json:"server" gorm:"foreignKey:ServerID"`
	Role         Role       `json:"role" gorm:"foreignKey:RoleID"`
	Permission   Permission `json:"permission" gorm:"foreignKey:PermissionID"`
}

func (ServerRolePermission) TableName() string {
	return "server_role_permissions"
}
