package migration

import (
	"berth/models"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
	"golang.org/x/crypto/pbkdf2"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	logger *logging.Service
}

type ExportData struct {
	Version              string                             `json:"version"`
	ExportedAt           time.Time                          `json:"exported_at"`
	EncryptionSecret     string                             `json:"encryption_secret"`
	Users                []models.User                      `json:"users"`
	Roles                []models.Role                      `json:"roles"`
	Permissions          []models.Permission                `json:"permissions"`
	Servers              []models.Server                    `json:"servers"`
	UserRoles            []UserRoleMapping                  `json:"user_roles"`
	ServerRoleStackPerms []models.ServerRoleStackPermission `json:"server_role_stack_permissions"`
	TOTPSecrets          []TOTPSecret                       `json:"totp_secrets"`
}

type UserRoleMapping struct {
	UserID uint `json:"user_id"`
	RoleID uint `json:"role_id"`
}

type TOTPSecret struct {
	ID      uint   `json:"id"`
	UserID  uint   `json:"user_id"`
	Secret  string `json:"secret"`
	Enabled bool   `json:"enabled"`
}

type EncryptedExport struct {
	Salt []byte `json:"salt"`
	IV   []byte `json:"iv"`
	Data []byte `json:"data"`
}

type ImportResult struct {
	EncryptionSecret string        `json:"encryption_secret"`
	Summary          ImportSummary `json:"summary"`
}

type ImportSummary struct {
	UsersImported       int `json:"users_imported"`
	RolesImported       int `json:"roles_imported"`
	ServersImported     int `json:"servers_imported"`
	TOTPSecretsImported int `json:"totp_secrets_imported"`
	PermissionsImported int `json:"permissions_imported"`
}

func NewService(db *gorm.DB, logger *logging.Service) *Service {
	return &Service{
		db:     db,
		logger: logger,
	}
}

func (s *Service) ExportData(password string) ([]byte, error) {
	s.logger.Info("starting data export")

	data, err := s.gatherExportData()
	if err != nil {
		s.logger.Error("failed to gather export data", zap.Error(err))
		return nil, err
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		s.logger.Error("failed to marshal export data", zap.Error(err))
		return nil, err
	}

	encryptedData, err := s.encryptData(jsonData, password)
	if err != nil {
		s.logger.Error("failed to encrypt export data", zap.Error(err))
		return nil, err
	}

	s.logger.Info("data export completed successfully")
	return encryptedData, nil
}

func (s *Service) ImportData(encryptedData []byte, password string) (*ImportResult, error) {
	s.logger.Info("starting data import")

	jsonData, err := s.decryptData(encryptedData, password)
	if err != nil {
		s.logger.Error("failed to decrypt import data", zap.Error(err))
		return nil, err
	}

	var data ExportData
	if err := json.Unmarshal(jsonData, &data); err != nil {
		s.logger.Error("failed to unmarshal import data", zap.Error(err))
		return nil, err
	}

	summary, err := s.importData(&data)
	if err != nil {
		s.logger.Error("failed to import data", zap.Error(err))
		return nil, err
	}

	result := &ImportResult{
		EncryptionSecret: data.EncryptionSecret,
		Summary:          *summary,
	}

	s.logger.Info("data import completed successfully", zap.Any("summary", summary))
	return result, nil
}

func (s *Service) gatherExportData() (*ExportData, error) {
	data := &ExportData{
		Version:    "1.0",
		ExportedAt: time.Now(),
	}

	encryptionSecret := os.Getenv("ENCRYPTION_SECRET")
	if encryptionSecret == "" {
		return nil, errors.New("ENCRYPTION_SECRET not found in environment")
	}
	data.EncryptionSecret = encryptionSecret

	if err := s.db.Find(&data.Users).Error; err != nil {
		return nil, fmt.Errorf("failed to export users: %w", err)
	}

	if err := s.db.Find(&data.Roles).Error; err != nil {
		return nil, fmt.Errorf("failed to export roles: %w", err)
	}

	if err := s.db.Find(&data.Permissions).Error; err != nil {
		return nil, fmt.Errorf("failed to export permissions: %w", err)
	}

	if err := s.db.Find(&data.Servers).Error; err != nil {
		return nil, fmt.Errorf("failed to export servers: %w", err)
	}

	if err := s.db.Find(&data.ServerRoleStackPerms).Error; err != nil {
		return nil, fmt.Errorf("failed to export server role stack permissions: %w", err)
	}

	var userRoles []struct {
		UserID uint `gorm:"column:user_id"`
		RoleID uint `gorm:"column:role_id"`
	}
	if err := s.db.Table("user_roles").Find(&userRoles).Error; err != nil {
		return nil, fmt.Errorf("failed to export user roles: %w", err)
	}
	for _, ur := range userRoles {
		data.UserRoles = append(data.UserRoles, UserRoleMapping{
			UserID: ur.UserID,
			RoleID: ur.RoleID,
		})
	}

	var totpSecrets []struct {
		ID      uint   `gorm:"column:id"`
		UserID  uint   `gorm:"column:user_id"`
		Secret  string `gorm:"column:secret"`
		Enabled bool   `gorm:"column:enabled"`
	}
	if err := s.db.Table("totp_secrets").Find(&totpSecrets).Error; err != nil {
		return nil, fmt.Errorf("failed to export TOTP secrets: %w", err)
	}
	for _, ts := range totpSecrets {
		data.TOTPSecrets = append(data.TOTPSecrets, TOTPSecret{
			ID:      ts.ID,
			UserID:  ts.UserID,
			Secret:  ts.Secret,
			Enabled: ts.Enabled,
		})
	}

	return data, nil
}

func (s *Service) importData(data *ExportData) (*ImportSummary, error) {
	summary := &ImportSummary{}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	s.logger.Info("clearing existing data for clean import")

	if err := tx.Exec("DELETE FROM server_role_stack_permissions").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear server role stack permissions: %w", err)
	}

	if err := tx.Exec("DELETE FROM user_roles").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear user roles: %w", err)
	}

	if err := tx.Exec("DELETE FROM totp_secrets").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear TOTP secrets: %w", err)
	}

	if err := tx.Exec("DELETE FROM servers").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear servers: %w", err)
	}

	if err := tx.Exec("DELETE FROM users").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear users: %w", err)
	}

	if err := tx.Exec("DELETE FROM roles").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear roles: %w", err)
	}

	if err := tx.Exec("DELETE FROM permissions").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to clear permissions: %w", err)
	}

	s.logger.Info("importing fresh data with preserved IDs")

	for _, permission := range data.Permissions {
		if err := tx.Exec(`INSERT INTO permissions (id, created_at, updated_at, deleted_at, name, resource, action, description) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			permission.ID, permission.CreatedAt, permission.UpdatedAt, permission.DeletedAt,
			permission.Name, permission.Resource, permission.Action, permission.Description).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to import permission %s: %w", permission.Name, err)
		}
	}
	summary.PermissionsImported = len(data.Permissions)

	if err := s.resetAutoIncrement(tx, "permissions", getMaxID(data.Permissions, func(p models.Permission) uint { return p.ID })); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to reset permissions sequence: %w", err)
	}

	for _, role := range data.Roles {
		if err := tx.Exec(`INSERT INTO roles (id, created_at, updated_at, deleted_at, name, description, is_admin) 
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			role.ID, role.CreatedAt, role.UpdatedAt, role.DeletedAt,
			role.Name, role.Description, role.IsAdmin).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to import role %s: %w", role.Name, err)
		}
	}
	summary.RolesImported = len(data.Roles)

	if err := s.resetAutoIncrement(tx, "roles", getMaxID(data.Roles, func(r models.Role) uint { return r.ID })); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to reset roles sequence: %w", err)
	}

	for _, user := range data.Users {
		if err := tx.Exec(`INSERT INTO users (id, created_at, updated_at, deleted_at, username, email, password, email_verified_at, last_login_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			user.ID, user.CreatedAt, user.UpdatedAt, user.DeletedAt,
			user.Username, user.Email, user.Password, user.EmailVerifiedAt, user.LastLoginAt).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to import user %s: %w", user.Username, err)
		}
	}
	summary.UsersImported = len(data.Users)

	if err := s.resetAutoIncrement(tx, "users", getMaxID(data.Users, func(u models.User) uint { return u.ID })); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to reset users sequence: %w", err)
	}

	for _, server := range data.Servers {
		if err := tx.Exec(`INSERT INTO servers (id, created_at, updated_at, deleted_at, name, description, host, port, skip_ssl_verification, access_token, is_active) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			server.ID, server.CreatedAt, server.UpdatedAt, server.DeletedAt,
			server.Name, server.Description, server.Host, server.Port, server.SkipSSLVerification, server.AccessToken, server.IsActive).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to import server %s: %w", server.Name, err)
		}
	}
	summary.ServersImported = len(data.Servers)

	if err := s.resetAutoIncrement(tx, "servers", getMaxID(data.Servers, func(s models.Server) uint { return s.ID })); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to reset servers sequence: %w", err)
	}

	for _, ur := range data.UserRoles {
		if err := tx.Exec("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", ur.UserID, ur.RoleID).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to import user role mapping: %w", err)
		}
	}

	for _, srsp := range data.ServerRoleStackPerms {
		if err := tx.Exec(`INSERT INTO server_role_stack_permissions (id, created_at, updated_at, deleted_at, server_id, role_id, permission_id, stack_pattern) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			srsp.ID, srsp.CreatedAt, srsp.UpdatedAt, srsp.DeletedAt,
			srsp.ServerID, srsp.RoleID, srsp.PermissionID, srsp.StackPattern).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to import server role stack permission: %w", err)
		}
	}

	if err := s.resetAutoIncrement(tx, "server_role_stack_permissions", getMaxID(data.ServerRoleStackPerms, func(srsp models.ServerRoleStackPermission) uint { return srsp.ID })); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to reset server_role_stack_permissions sequence: %w", err)
	}

	for _, ts := range data.TOTPSecrets {
		if err := tx.Exec("INSERT INTO totp_secrets (id, user_id, secret, enabled) VALUES (?, ?, ?, ?)",
			ts.ID, ts.UserID, ts.Secret, ts.Enabled).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to import TOTP secret: %w", err)
		}
	}
	summary.TOTPSecretsImported = len(data.TOTPSecrets)

	if err := s.resetAutoIncrement(tx, "totp_secrets", getMaxID(data.TOTPSecrets, func(ts TOTPSecret) uint { return ts.ID })); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to reset totp_secrets sequence: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit import transaction: %w", err)
	}

	s.logger.Info("import completed successfully",
		zap.Int("permissions", summary.PermissionsImported),
		zap.Int("roles", summary.RolesImported),
		zap.Int("users", summary.UsersImported),
		zap.Int("servers", summary.ServersImported),
		zap.Int("totp_secrets", summary.TOTPSecretsImported),
	)

	return summary, nil
}

func (s *Service) resetAutoIncrement(tx *gorm.DB, tableName string, maxID uint) error {
	if maxID == 0 {
		return nil
	}

	if err := tx.Exec("UPDATE sqlite_sequence SET seq = ? WHERE name = ?", maxID, tableName).Error; err != nil {
		return err
	}

	var count int64
	if err := tx.Raw("SELECT COUNT(*) FROM sqlite_sequence WHERE name = ?", tableName).Scan(&count).Error; err != nil {
		return err
	}

	if count == 0 {
		if err := tx.Exec("INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)", tableName, maxID).Error; err != nil {
			return err
		}
	}

	return nil
}

func getMaxID[T any](items []T, getID func(T) uint) uint {
	var maxID uint = 0
	for _, item := range items {
		if id := getID(item); id > maxID {
			maxID = id
		}
	}
	return maxID
}

func (s *Service) encryptData(data []byte, password string) ([]byte, error) {
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}

	key := pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	encrypted := gcm.Seal(nil, nonce, data, nil)

	result := EncryptedExport{
		Salt: salt,
		IV:   nonce,
		Data: encrypted,
	}

	return json.Marshal(result)
}

func (s *Service) decryptData(encryptedData []byte, password string) ([]byte, error) {
	var encrypted EncryptedExport
	if err := json.Unmarshal(encryptedData, &encrypted); err != nil {
		return nil, err
	}

	key := pbkdf2.Key([]byte(password), encrypted.Salt, 100000, 32, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return gcm.Open(nil, encrypted.IV, encrypted.Data, nil)
}
