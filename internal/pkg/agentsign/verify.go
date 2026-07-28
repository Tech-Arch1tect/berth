package agentsign

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

const (
	ResponseContext = "berth-response-v1"
	BodyUnsigned    = "unsigned"
	BodyFramed      = "framed"

	VerificationSkew = time.Minute

	MaxBufferedResponseBytes = 8 * 1024 * 1024
)

var ErrUnverified = errors.New("the agent's response could not be verified")

func ResponseBase(requestNonce string, status int, contentType string, bodyDigest string, timestamp int64) []byte {
	return Canonical(
		ResponseContext,
		requestNonce,
		strconv.Itoa(status),
		contentType,
		bodyDigest,
		strconv.FormatInt(timestamp, 10),
	)
}

type ResponseVerifier struct {
	authority *x509.CertPool
	identity  string
	pinned    string
	skew      time.Duration
}

func NewResponseVerifier(authorityPEM, identity, pinnedFingerprint string, skew time.Duration) (*ResponseVerifier, error) {
	authority := x509.NewCertPool()
	if !authority.AppendCertsFromPEM([]byte(authorityPEM)) {
		return nil, errors.New("the stored certificate authority does not contain a certificate")
	}
	if pinnedFingerprint == "" {
		return nil, errors.New("no agent certificate bundle has been issued for this server, so berth cannot tell which agent it should be talking to")
	}
	return &ResponseVerifier{authority: authority, identity: identity, pinned: pinnedFingerprint, skew: skew}, nil
}

func (v *ResponseVerifier) Verify(resp *http.Response, requestNonce string, body []byte) (*x509.Certificate, error) {
	signature, err := base64.StdEncoding.DecodeString(resp.Header.Get(HeaderSignature))
	if err != nil || len(signature) == 0 {
		return nil, ErrUnverified
	}
	certificateDER, err := base64.StdEncoding.DecodeString(resp.Header.Get(HeaderCertificate))
	if err != nil || len(certificateDER) == 0 {
		return nil, ErrUnverified
	}
	timestamp, err := strconv.ParseInt(resp.Header.Get(HeaderTimestamp), 10, 64)
	if err != nil {
		return nil, ErrUnverified
	}
	if difference := time.Since(time.Unix(timestamp, 0)); difference > v.skew || difference < -v.skew {
		return nil, ErrUnverified
	}

	certificate, err := x509.ParseCertificate(certificateDER)
	if err != nil {
		return nil, ErrUnverified
	}
	if _, err := certificate.Verify(x509.VerifyOptions{
		Roots:     v.authority,
		KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}); err != nil {
		return nil, ErrUnverified
	}
	if err := certificate.VerifyHostname(v.identity); err != nil {
		return nil, ErrUnverified
	}
	presented := sha256.Sum256(certificate.Raw)
	if hex.EncodeToString(presented[:]) != v.pinned {
		return nil, fmt.Errorf("%w: the agent presented a certificate berth did not issue for it", ErrUnverified)
	}

	publicKey, ok := certificate.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, ErrUnverified
	}

	claimedDigest := resp.Header.Get(HeaderBodyDigest)
	base := ResponseBase(requestNonce, resp.StatusCode, resp.Header.Get("Content-Type"), claimedDigest, timestamp)
	digest := sha256.Sum256(base)
	if !ecdsa.VerifyASN1(publicKey, digest[:], signature) {
		return nil, ErrUnverified
	}

	if !bodyTravelsSeparately(claimedDigest) && BodyDigest(body) != claimedDigest {
		return nil, fmt.Errorf("%w: the response body does not match what the agent signed", ErrUnverified)
	}
	return certificate, nil
}

func bodyTravelsSeparately(claimedDigest string) bool {
	return claimedDigest == BodyUnsigned || claimedDigest == BodyFramed
}

func VerifyResponse(verifier *ResponseVerifier, signer *Signer, requestNonce string, resp *http.Response, limit int64) (*x509.Certificate, error) {
	if resp == nil || resp.Header.Get(HeaderSignature) == "" {
		return nil, ErrUnverified
	}
	claimedDigest := resp.Header.Get(HeaderBodyDigest)

	var body []byte
	if !bodyTravelsSeparately(claimedDigest) {
		if resp.Body == nil {
			return nil, ErrUnverified
		}
		collected, err := io.ReadAll(io.LimitReader(resp.Body, limit))
		if err != nil {
			return nil, ErrUnverified
		}
		_ = resp.Body.Close()
		resp.Body = io.NopCloser(bytes.NewReader(collected))
		body = collected
	}

	certificate, err := verifier.Verify(resp, requestNonce, body)
	if err != nil {
		return nil, err
	}

	if claimedDigest == BodyFramed {
		if resp.Body == nil || signer == nil {
			return nil, ErrUnverified
		}
		key, keyErr := signer.SessionKeyFor(certificate, requestNonce)
		if keyErr != nil {
			return nil, ErrUnverified
		}
		resp.Body = NewBodyReader(resp.Body, key)
	}
	return certificate, nil
}
