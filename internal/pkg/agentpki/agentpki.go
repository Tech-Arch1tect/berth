package agentpki

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"time"
)

const (
	ServerIdentity      = "berth-server"
	AgentCertFile       = "server.crt"
	AgentKeyFile        = "server.key"
	AuthorityFile       = "ca.crt"
	authorityName       = "berth agent authority"
	authorityValidUntil = 20 * 365 * 24 * time.Hour
	leafValidUntil      = 10 * 365 * 24 * time.Hour
)

func AgentIdentity(serverID uint) string {
	return fmt.Sprintf("berth-agent-%d", serverID)
}

type Material struct {
	CertPEM     string
	KeyPEM      string
	Certificate *x509.Certificate
}

func (m Material) Fingerprint() string {
	sum := sha256.Sum256(m.Certificate.Raw)
	return hex.EncodeToString(sum[:])
}

func (m Material) NotAfter() time.Time {
	return m.Certificate.NotAfter
}

func NewAuthority() (Material, error) {
	return issue(&x509.Certificate{
		Subject:               pkix.Name{CommonName: authorityName},
		IsCA:                  true,
		MaxPathLen:            0,
		MaxPathLenZero:        true,
		KeyUsage:              x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
		NotAfter:              time.Now().Add(authorityValidUntil),
	}, nil)
}

func IssueClient(authority Material) (Material, error) {
	return issue(leaf(ServerIdentity, x509.ExtKeyUsageClientAuth, authority.NotAfter()), &authority)
}

func IssueAgent(authority Material, serverID uint) (Material, error) {
	return issue(leaf(AgentIdentity(serverID), x509.ExtKeyUsageServerAuth, authority.NotAfter()), &authority)
}

func Load(certPEM, keyPEM string) (Material, error) {
	block, _ := pem.Decode([]byte(certPEM))
	if block == nil {
		return Material{}, errors.New("stored certificate is not valid PEM")
	}
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return Material{}, fmt.Errorf("stored certificate could not be parsed: %w", err)
	}
	return Material{CertPEM: certPEM, KeyPEM: keyPEM, Certificate: certificate}, nil
}

func Bundle(agent Material, authorityCertPEM string) ([]byte, error) {
	var archive bytes.Buffer
	compressor := gzip.NewWriter(&archive)
	writer := tar.NewWriter(compressor)

	files := []struct {
		name    string
		content string
		mode    int64
	}{
		{AgentCertFile, agent.CertPEM, 0o644},
		{AgentKeyFile, agent.KeyPEM, 0o600},
		{AuthorityFile, authorityCertPEM, 0o644},
	}
	for _, file := range files {
		header := &tar.Header{
			Name:    file.name,
			Mode:    file.mode,
			Size:    int64(len(file.content)),
			ModTime: agent.Certificate.NotBefore,
		}
		if err := writer.WriteHeader(header); err != nil {
			return nil, err
		}
		if _, err := writer.Write([]byte(file.content)); err != nil {
			return nil, err
		}
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}
	if err := compressor.Close(); err != nil {
		return nil, err
	}
	return archive.Bytes(), nil
}

func leaf(identity string, usage x509.ExtKeyUsage, authorityNotAfter time.Time) *x509.Certificate {
	notAfter := time.Now().Add(leafValidUntil)
	if notAfter.After(authorityNotAfter) {
		notAfter = authorityNotAfter
	}
	return &x509.Certificate{
		Subject:     pkix.Name{CommonName: identity},
		DNSNames:    []string{identity},
		KeyUsage:    x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{usage},
		NotAfter:    notAfter,
	}
}

func issue(template *x509.Certificate, authority *Material) (Material, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return Material{}, fmt.Errorf("failed to generate a key: %w", err)
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return Material{}, fmt.Errorf("failed to generate a serial number: %w", err)
	}
	template.SerialNumber = serial
	template.NotBefore = time.Now().Add(-time.Hour)

	signerCert := template
	var signerKey crypto.Signer = key
	if authority != nil {
		signerCert = authority.Certificate
		signerKey, err = parsePrivateKey(authority.KeyPEM)
		if err != nil {
			return Material{}, err
		}
	}

	der, err := x509.CreateCertificate(rand.Reader, template, signerCert, &key.PublicKey, signerKey)
	if err != nil {
		return Material{}, fmt.Errorf("failed to create the certificate: %w", err)
	}
	certificate, err := x509.ParseCertificate(der)
	if err != nil {
		return Material{}, fmt.Errorf("failed to parse the new certificate: %w", err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return Material{}, fmt.Errorf("failed to encode the new key: %w", err)
	}

	return Material{
		CertPEM:     encodePEM("CERTIFICATE", der),
		KeyPEM:      encodePEM("PRIVATE KEY", keyDER),
		Certificate: certificate,
	}, nil
}

func parsePrivateKey(keyPEM string) (crypto.Signer, error) {
	block, _ := pem.Decode([]byte(keyPEM))
	if block == nil {
		return nil, errors.New("stored key is not valid PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("stored key could not be parsed: %w", err)
	}
	signer, ok := parsed.(crypto.Signer)
	if !ok {
		return nil, errors.New("stored key cannot sign")
	}
	return signer, nil
}

func encodePEM(blockType string, der []byte) string {
	return string(pem.EncodeToMemory(&pem.Block{Type: blockType, Bytes: der}))
}
