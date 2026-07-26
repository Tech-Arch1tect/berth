package server

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"berth/internal/pkg/agentpki"
	"berth/internal/pkg/agentsign"
	"berth/internal/platform/db"

	"gorm.io/gorm"
)

type AgentAuthority struct {
	db.BaseModel
	CertPEM       string `json:"-" gorm:"not null"`
	KeyPEM        string `json:"-" gorm:"not null"`
	ClientCertPEM string `json:"-" gorm:"not null"`
	ClientKeyPEM  string `json:"-" gorm:"not null"`
}

func bundleFilename(server *Server) string {
	slug := strings.Trim(nonAlphanumeric.ReplaceAllString(strings.ToLower(server.Name), "-"), "-")
	if slug == "" {
		slug = "server"
	}
	return fmt.Sprintf("berth-agent-%s-%d-certificates.tar.gz", slug, server.ID)
}

var nonAlphanumeric = regexp.MustCompile(`[^a-z0-9]+`)

type AgentAuthorityStatus struct {
	Exists               bool   `json:"exists"`
	AuthorityExpiresAt   string `json:"authority_expires_at,omitempty"`
	AuthorityFingerprint string `json:"authority_fingerprint,omitempty"`
	ClientExpiresAt      string `json:"client_expires_at,omitempty"`
	ClientFingerprint    string `json:"client_fingerprint,omitempty"`
	AgentsNeedingReissue int64  `json:"agents_needing_reissue"`
}

func (s *Service) AgentAuthorityStatus() (AgentAuthorityStatus, error) {
	var record AgentAuthority
	err := s.db.First(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return AgentAuthorityStatus{}, nil
	}
	if err != nil {
		return AgentAuthorityStatus{}, fmt.Errorf("failed to read the agent certificate authority: %w", err)
	}

	authority, client, err := s.decryptAuthority(record)
	if err != nil {
		return AgentAuthorityStatus{}, err
	}

	var needingReissue int64
	if err := s.db.Model(&Server{}).
		Where("agent_cert_fingerprint <> '' AND agent_cert_authority_fingerprint <> ?", authority.Fingerprint()).
		Count(&needingReissue).Error; err != nil {
		return AgentAuthorityStatus{}, fmt.Errorf("failed to count servers needing a new bundle: %w", err)
	}

	return AgentAuthorityStatus{
		Exists:               true,
		AuthorityExpiresAt:   authority.NotAfter().Format(time.RFC3339),
		AuthorityFingerprint: authority.Fingerprint(),
		ClientExpiresAt:      client.NotAfter().Format(time.RFC3339),
		ClientFingerprint:    client.Fingerprint(),
		AgentsNeedingReissue: needingReissue,
	}, nil
}

func (s *Service) RotateAgentAuthority() error {
	s.authorityMutex.Lock()
	defer s.authorityMutex.Unlock()

	authority, client, err := newAuthorityMaterial()
	if err != nil {
		return err
	}

	authorityKey, err := s.crypto.Encrypt(authority.KeyPEM)
	if err != nil {
		return fmt.Errorf("failed to encrypt the authority key: %w", err)
	}
	clientKey, err := s.crypto.Encrypt(client.KeyPEM)
	if err != nil {
		return fmt.Errorf("failed to encrypt the client key: %w", err)
	}

	var existing AgentAuthority
	err = s.db.First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		s.forgetClientSigner()
		return s.db.Create(&AgentAuthority{
			CertPEM:       authority.CertPEM,
			KeyPEM:        authorityKey,
			ClientCertPEM: client.CertPEM,
			ClientKeyPEM:  clientKey,
		}).Error
	}
	if err != nil {
		return fmt.Errorf("failed to read the agent certificate authority: %w", err)
	}

	if err := s.db.Model(&existing).Updates(map[string]any{
		"cert_pem":        authority.CertPEM,
		"key_pem":         authorityKey,
		"client_cert_pem": client.CertPEM,
		"client_key_pem":  clientKey,
	}).Error; err != nil {
		return fmt.Errorf("failed to store the new agent certificate authority: %w", err)
	}
	s.forgetClientSigner()
	return nil
}

func newAuthorityMaterial() (authority agentpki.Material, client agentpki.Material, err error) {
	authority, err = agentpki.NewAuthority()
	if err != nil {
		return authority, client, fmt.Errorf("failed to create the agent certificate authority: %w", err)
	}
	client, err = agentpki.IssueClient(authority)
	if err != nil {
		return authority, client, fmt.Errorf("failed to issue this server's client certificate: %w", err)
	}
	return authority, client, nil
}

func (s *Service) ReissueClientCertificate() error {
	authority, _, err := s.ensureAgentAuthority()
	if err != nil {
		return err
	}

	client, err := agentpki.IssueClient(authority)
	if err != nil {
		return fmt.Errorf("failed to issue a new client certificate: %w", err)
	}
	clientKey, err := s.crypto.Encrypt(client.KeyPEM)
	if err != nil {
		return fmt.Errorf("failed to encrypt the new client key: %w", err)
	}

	var record AgentAuthority
	if err := s.db.First(&record).Error; err != nil {
		return fmt.Errorf("failed to read the agent certificate authority: %w", err)
	}
	if err := s.db.Model(&record).Updates(map[string]any{
		"client_cert_pem": client.CertPEM,
		"client_key_pem":  clientKey,
	}).Error; err != nil {
		return fmt.Errorf("failed to store the new client certificate: %w", err)
	}
	s.forgetClientSigner()
	return nil
}

func (s *Service) ClientSigner() (*agentsign.Signer, error) {
	s.signerMutex.Lock()
	defer s.signerMutex.Unlock()
	if s.signer != nil {
		return s.signer, nil
	}

	var record AgentAuthority
	if err := s.db.First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("berth has no agent certificate authority yet; issue an agent certificate bundle for a server to create one")
		}
		return nil, fmt.Errorf("failed to read the agent certificate authority: %w", err)
	}

	clientKey, err := s.crypto.Decrypt(record.ClientKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt the client key: %w", err)
	}
	signer, err := agentsign.NewSigner(record.ClientCertPEM, clientKey)
	if err != nil {
		return nil, err
	}

	s.signer = signer
	return signer, nil
}

func (s *Service) forgetClientSigner() {
	s.signerMutex.Lock()
	s.signer = nil
	s.signerMutex.Unlock()
}

func (s *Service) IssueAgentBundle(serverID uint) ([]byte, error) {
	server, err := s.GetServer(serverID)
	if err != nil {
		return nil, err
	}

	authority, _, err := s.ensureAgentAuthority()
	if err != nil {
		return nil, err
	}

	agent, err := agentpki.IssueAgent(authority, server.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to issue a certificate for this server: %w", err)
	}

	issuedAt := time.Now()
	expiresAt := agent.NotAfter()
	if err := s.db.Model(&Server{}).Where("id = ?", server.ID).Updates(map[string]any{
		"agent_cert_fingerprint":           agent.Fingerprint(),
		"agent_cert_authority_fingerprint": authority.Fingerprint(),
		"agent_cert_issued_at":             issuedAt,
		"agent_cert_expires_at":            expiresAt,
	}).Error; err != nil {
		return nil, fmt.Errorf("failed to record the issued certificate: %w", err)
	}

	return agentpki.Bundle(agent, authority.CertPEM)
}

func (s *Service) ensureAgentAuthority() (authority agentpki.Material, client agentpki.Material, err error) {
	s.authorityMutex.Lock()
	defer s.authorityMutex.Unlock()

	var record AgentAuthority
	err = s.db.First(&record).Error
	if err == nil {
		return s.decryptAuthority(record)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return authority, client, fmt.Errorf("failed to read the agent certificate authority: %w", err)
	}

	authority, client, err = newAuthorityMaterial()
	if err != nil {
		return authority, client, err
	}

	authorityKey, err := s.crypto.Encrypt(authority.KeyPEM)
	if err != nil {
		return authority, client, fmt.Errorf("failed to encrypt the authority key: %w", err)
	}
	clientKey, err := s.crypto.Encrypt(client.KeyPEM)
	if err != nil {
		return authority, client, fmt.Errorf("failed to encrypt the client key: %w", err)
	}

	if err := s.db.Create(&AgentAuthority{
		CertPEM:       authority.CertPEM,
		KeyPEM:        authorityKey,
		ClientCertPEM: client.CertPEM,
		ClientKeyPEM:  clientKey,
	}).Error; err != nil {
		return authority, client, fmt.Errorf("failed to store the agent certificate authority: %w", err)
	}

	return authority, client, nil
}

func (s *Service) decryptAuthority(record AgentAuthority) (authority agentpki.Material, client agentpki.Material, err error) {
	authorityKey, err := s.crypto.Decrypt(record.KeyPEM)
	if err != nil {
		return authority, client, fmt.Errorf("failed to decrypt the authority key: %w", err)
	}
	clientKey, err := s.crypto.Decrypt(record.ClientKeyPEM)
	if err != nil {
		return authority, client, fmt.Errorf("failed to decrypt the client key: %w", err)
	}

	authority, err = agentpki.Load(record.CertPEM, authorityKey)
	if err != nil {
		return authority, client, err
	}
	client, err = agentpki.Load(record.ClientCertPEM, clientKey)
	if err != nil {
		return authority, client, err
	}
	return authority, client, nil
}
