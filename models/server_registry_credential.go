package models

type ServerRegistryCredential struct {
	BaseModel
	ServerID    uint   `json:"server_id" gorm:"not null;index:idx_server_registry,unique"`
	RegistryURL string `json:"registry_url" gorm:"not null;index:idx_server_registry,unique"`
	Username    string `json:"username" gorm:"not null"`
	Password    string `json:"-" gorm:"not null"`
	IsDefault   bool   `json:"is_default" gorm:"default:false"`
	Server      Server `json:"server" gorm:"foreignKey:ServerID"`
}

func (ServerRegistryCredential) TableName() string {
	return "server_registry_credentials"
}
