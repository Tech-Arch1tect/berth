package models

type ServerRegistryCredential struct {
	BaseModel
	ServerID     uint   `json:"server_id" gorm:"not null;index:idx_server_stack_registry,unique"`
	StackPattern string `json:"stack_pattern" gorm:"not null;default:'*';index:idx_server_stack_registry,unique"`
	RegistryURL  string `json:"registry_url" gorm:"not null;index:idx_server_stack_registry,unique"`
	ImagePattern string `json:"image_pattern"`
	Username     string `json:"username" gorm:"not null"`
	Password     string `json:"-" gorm:"not null"`
	Server       Server `json:"server" gorm:"foreignKey:ServerID"`
}

func (ServerRegistryCredential) TableName() string {
	return "server_registry_credentials"
}
