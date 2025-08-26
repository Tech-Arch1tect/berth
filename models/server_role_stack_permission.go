package models

type ServerRoleStackPermission struct {
	BaseModel
	ServerID     uint       `json:"server_id" gorm:"not null"`
	RoleID       uint       `json:"role_id" gorm:"not null"`
	PermissionID uint       `json:"permission_id" gorm:"not null"`
	StackPattern string     `json:"stack_pattern" gorm:"not null;default:'*'"`
	Server       Server     `json:"server" gorm:"foreignKey:ServerID"`
	Role         Role       `json:"role" gorm:"foreignKey:RoleID"`
	Permission   Permission `json:"permission" gorm:"foreignKey:PermissionID"`
}

func (ServerRoleStackPermission) TableName() string {
	return "server_role_stack_permissions"
}
