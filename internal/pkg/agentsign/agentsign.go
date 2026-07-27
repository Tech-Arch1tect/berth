package agentsign

import (
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

const (
	HeaderSignature   = "X-Berth-Signature"
	HeaderCertificate = "X-Berth-Certificate"
	HeaderTimestamp   = "X-Berth-Timestamp"
	HeaderNonce       = "X-Berth-Nonce"

	RequestContext = "berth-request-v1"
)

func Canonical(fields ...string) []byte {
	var base bytes.Buffer
	for _, field := range fields {
		_ = binary.Write(&base, binary.BigEndian, uint32(len(field)))
		base.WriteString(field)
	}
	return base.Bytes()
}

func RequestBase(method, target, contentType string, body []byte, timestamp int64, nonce string) []byte {
	digest := sha256.Sum256(body)
	return Canonical(
		RequestContext,
		method,
		target,
		contentType,
		hex.EncodeToString(digest[:]),
		strconv.FormatInt(timestamp, 10),
		nonce,
	)
}

func NewNonce() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("failed to generate a nonce: %w", err)
	}
	return hex.EncodeToString(raw), nil
}

type Signer struct {
	certificate []byte
	key         crypto.Signer
}

func NewSigner(certPEM, keyPEM string) (*Signer, error) {
	certBlock, _ := pem.Decode([]byte(certPEM))
	if certBlock == nil {
		return nil, errors.New("signing certificate is not valid PEM")
	}
	certificate, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("signing certificate could not be parsed: %w", err)
	}

	keyBlock, _ := pem.Decode([]byte(keyPEM))
	if keyBlock == nil {
		return nil, errors.New("signing key is not valid PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("signing key could not be parsed: %w", err)
	}
	key, ok := parsed.(crypto.Signer)
	if !ok {
		return nil, errors.New("signing key cannot sign")
	}

	return &Signer{certificate: certificate.Raw, key: key}, nil
}

func (s *Signer) SessionKeyFor(peer *x509.Certificate, salt string) ([]byte, error) {
	local, ok := s.key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, errors.New("berth's client key cannot agree a session key")
	}
	remote, ok := peer.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("the agent's certificate cannot agree a session key")
	}
	return SessionKey(local, remote, salt)
}

func (s *Signer) SignRequest(req *http.Request, body []byte) error {
	nonce, err := NewNonce()
	if err != nil {
		return err
	}
	timestamp := time.Now().Unix()

	base := RequestBase(req.Method, req.URL.RequestURI(), req.Header.Get("Content-Type"), body, timestamp, nonce)
	digest := sha256.Sum256(base)
	signature, err := s.key.Sign(rand.Reader, digest[:], crypto.SHA256)
	if err != nil {
		return fmt.Errorf("failed to sign the request: %w", err)
	}

	req.Header.Set(HeaderSignature, base64.StdEncoding.EncodeToString(signature))
	req.Header.Set(HeaderCertificate, base64.StdEncoding.EncodeToString(s.certificate))
	req.Header.Set(HeaderTimestamp, strconv.FormatInt(timestamp, 10))
	req.Header.Set(HeaderNonce, nonce)
	return nil
}

func (s *Signer) SignHeaders(method, target, contentType string, body []byte, header http.Header) error {
	nonce, err := NewNonce()
	if err != nil {
		return err
	}
	timestamp := time.Now().Unix()

	base := RequestBase(method, target, contentType, body, timestamp, nonce)
	digest := sha256.Sum256(base)
	signature, err := s.key.Sign(rand.Reader, digest[:], crypto.SHA256)
	if err != nil {
		return fmt.Errorf("failed to sign the request: %w", err)
	}

	header.Set(HeaderSignature, base64.StdEncoding.EncodeToString(signature))
	header.Set(HeaderCertificate, base64.StdEncoding.EncodeToString(s.certificate))
	header.Set(HeaderTimestamp, strconv.FormatInt(timestamp, 10))
	header.Set(HeaderNonce, nonce)
	return nil
}
