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

	HeaderBodyDigest = "X-Berth-Body-Digest"

	VerificationSkew = time.Minute
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

func BodyDigest(body []byte) string {
	digest := sha256.Sum256(body)
	return hex.EncodeToString(digest[:])
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
	return &ResponseVerifier{authority: authority, identity: identity, pinned: pinnedFingerprint, skew: skew}, nil
}

func (v *ResponseVerifier) Verify(resp *http.Response, requestNonce string, body []byte) error {
	signature, err := base64.StdEncoding.DecodeString(resp.Header.Get(HeaderSignature))
	if err != nil || len(signature) == 0 {
		return ErrUnverified
	}
	certificateDER, err := base64.StdEncoding.DecodeString(resp.Header.Get(HeaderCertificate))
	if err != nil || len(certificateDER) == 0 {
		return ErrUnverified
	}
	timestamp, err := strconv.ParseInt(resp.Header.Get(HeaderTimestamp), 10, 64)
	if err != nil {
		return ErrUnverified
	}
	if difference := time.Since(time.Unix(timestamp, 0)); difference > v.skew || difference < -v.skew {
		return ErrUnverified
	}

	certificate, err := x509.ParseCertificate(certificateDER)
	if err != nil {
		return ErrUnverified
	}
	if _, err := certificate.Verify(x509.VerifyOptions{
		Roots:     v.authority,
		KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}); err != nil {
		return ErrUnverified
	}
	if err := certificate.VerifyHostname(v.identity); err != nil {
		return ErrUnverified
	}
	if v.pinned != "" {
		presented := sha256.Sum256(certificate.Raw)
		if hex.EncodeToString(presented[:]) != v.pinned {
			return fmt.Errorf("%w: the agent presented a certificate berth did not issue for it", ErrUnverified)
		}
	}

	publicKey, ok := certificate.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return ErrUnverified
	}

	claimedDigest := resp.Header.Get(HeaderBodyDigest)
	base := ResponseBase(requestNonce, resp.StatusCode, resp.Header.Get("Content-Type"), claimedDigest, timestamp)
	digest := sha256.Sum256(base)
	if !ecdsa.VerifyASN1(publicKey, digest[:], signature) {
		return ErrUnverified
	}

	if claimedDigest != BodyUnsigned && BodyDigest(body) != claimedDigest {
		return fmt.Errorf("%w: the response body does not match what the agent signed", ErrUnverified)
	}
	return nil
}

func BodyWasSigned(resp *http.Response) bool {
	return resp.Header.Get(HeaderBodyDigest) != BodyUnsigned
}

func VerifyResponse(verifier *ResponseVerifier, requestNonce string, resp *http.Response, limit int64) error {
	var body []byte
	if BodyWasSigned(resp) {
		collected, err := io.ReadAll(io.LimitReader(resp.Body, limit))
		if err != nil {
			return ErrUnverified
		}
		_ = resp.Body.Close()
		resp.Body = io.NopCloser(bytes.NewReader(collected))
		body = collected
	}
	return verifier.Verify(resp, requestNonce, body)
}
