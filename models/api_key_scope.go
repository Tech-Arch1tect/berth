package models

type APIKeyScope struct {
	BaseModel
	APIKeyID     uint       `json:"api_key_id" gorm:"not null;index"`
	ServerID     *uint      `json:"server_id" gorm:"index"`
	StackPattern string     `json:"stack_pattern" gorm:"not null;default:'*'"`
	PermissionID uint       `json:"permission_id" gorm:"not null"`
	APIKey       APIKey     `json:"api_key" gorm:"foreignKey:APIKeyID"`
	Server       *Server    `json:"server" gorm:"foreignKey:ServerID"`
	Permission   Permission `json:"permission" gorm:"foreignKey:PermissionID"`
}

func (APIKeyScope) TableName() string {
	return "api_key_scopes"
}

type APIKeyScopeResponse struct {
	ID           uint   `json:"id"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
	APIKeyID     uint   `json:"api_key_id"`
	ServerID     *uint  `json:"server_id"`
	ServerName   string `json:"server_name,omitempty"`
	StackPattern string `json:"stack_pattern"`
	PermissionID uint   `json:"permission_id"`
	Permission   string `json:"permission"`
}

func (s *APIKeyScope) ToResponse() APIKeyScopeResponse {
	resp := APIKeyScopeResponse{
		ID:           s.ID,
		CreatedAt:    s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		APIKeyID:     s.APIKeyID,
		ServerID:     s.ServerID,
		StackPattern: s.StackPattern,
		PermissionID: s.PermissionID,
		Permission:   s.Permission.Name,
	}

	if s.Server != nil {
		resp.ServerName = s.Server.Name
	}

	return resp
}
