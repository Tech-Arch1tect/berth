package testsupport

import (
	"bufio"
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"berth/internal/pkg/agentsign"
)

type AgentResponseSigner struct {
	certificate []byte
	key         crypto.Signer
}

func NewAgentResponseSigner(certPEM, keyPEM string) (*AgentResponseSigner, error) {
	certBlock, _ := pem.Decode([]byte(certPEM))
	if certBlock == nil {
		return nil, errors.New("agent certificate is not valid PEM")
	}
	certificate, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, err
	}
	keyBlock, _ := pem.Decode([]byte(keyPEM))
	if keyBlock == nil {
		return nil, errors.New("agent key is not valid PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
	if err != nil {
		return nil, err
	}
	key, ok := parsed.(crypto.Signer)
	if !ok {
		return nil, errors.New("agent key cannot sign")
	}
	return &AgentResponseSigner{certificate: certificate.Raw, key: key}, nil
}

func (s *AgentResponseSigner) Apply(header http.Header, requestNonce string, status int, contentType, bodyDigest string) {
	timestamp := time.Now().Unix()
	base := agentsign.ResponseBase(requestNonce, status, contentType, bodyDigest, timestamp)
	digest := sha256.Sum256(base)
	signature, err := s.key.Sign(rand.Reader, digest[:], crypto.SHA256)
	if err != nil {
		return
	}
	header.Set(agentsign.HeaderSignature, base64.StdEncoding.EncodeToString(signature))
	header.Set(agentsign.HeaderCertificate, base64.StdEncoding.EncodeToString(s.certificate))
	header.Set(agentsign.HeaderTimestamp, strconv.FormatInt(timestamp, 10))
	header.Set(agentsign.HeaderBodyDigest, bodyDigest)
}

func (s *AgentResponseSigner) StreamSession(r *http.Request) (*agentsign.FrameWriter, *agentsign.FrameReader, error) {
	peerDER, err := base64.StdEncoding.DecodeString(r.Header.Get(agentsign.HeaderCertificate))
	if err != nil {
		return nil, nil, err
	}
	peer, err := x509.ParseCertificate(peerDER)
	if err != nil {
		return nil, nil, err
	}
	local, ok := s.key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, nil, errors.New("the agent key cannot agree a session key")
	}
	remote, ok := peer.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, nil, errors.New("berth's certificate cannot agree a session key")
	}
	key, err := agentsign.SessionKey(local, remote, r.Header.Get(agentsign.HeaderNonce))
	if err != nil {
		return nil, nil, err
	}
	return agentsign.NewFrameWriter(key, agentsign.DirectionToBerth),
		agentsign.NewFrameReader(key, agentsign.DirectionToAgent), nil
}

func (s *AgentResponseSigner) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
			s.Apply(w.Header(), r.Header.Get(agentsign.HeaderNonce), http.StatusSwitchingProtocols, "", agentsign.BodyUnsigned)
			next.ServeHTTP(w, r)
			return
		}
		writer := &signingRecorder{ResponseWriter: w, signer: s, nonce: r.Header.Get(agentsign.HeaderNonce), status: http.StatusOK}
		next.ServeHTTP(writer, r)
		writer.finish()
	})
}

type signingRecorder struct {
	http.ResponseWriter
	signer    *AgentResponseSigner
	nonce     string
	status    int
	buffer    bytes.Buffer
	committed bool
}

func (w *signingRecorder) WriteHeader(status int) { w.status = status }

func (w *signingRecorder) Write(payload []byte) (int, error) {
	if w.committed {
		return w.ResponseWriter.Write(payload)
	}
	return w.buffer.Write(payload)
}

func (w *signingRecorder) Flush() {
	if !w.committed {
		w.commit(agentsign.BodyUnsigned)
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *signingRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("the response writer cannot be hijacked")
	}
	if !w.committed {
		w.signer.Apply(w.Header(), w.nonce, http.StatusSwitchingProtocols, "", agentsign.BodyUnsigned)
		w.committed = true
	}
	return hijacker.Hijack()
}

func (w *signingRecorder) finish() {
	if !w.committed {
		w.commit(agentsign.BodyDigest(w.buffer.Bytes()))
	}
}

func (w *signingRecorder) commit(bodyDigest string) {
	w.signer.Apply(w.Header(), w.nonce, w.status, w.Header().Get("Content-Type"), bodyDigest)
	w.ResponseWriter.WriteHeader(w.status)
	if w.buffer.Len() > 0 {
		_, _ = w.ResponseWriter.Write(w.buffer.Bytes())
		w.buffer.Reset()
	}
	w.committed = true
}
