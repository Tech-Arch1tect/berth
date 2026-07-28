package agent

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"berth/internal/domain/server"
	"berth/internal/pkg/agentpki"
	"berth/internal/pkg/agentsign"

	"go.uber.org/zap"
)

type signerProvider interface {
	ClientSigner() (*agentsign.Signer, error)
	ResponseVerifier(target *server.Server) (*agentsign.ResponseVerifier, error)
}

type Service struct {
	logger           *zap.Logger
	operationTimeout time.Duration
	readTimeout      time.Duration
	signers          signerProvider
}

func (s *Service) SetSignerProvider(provider signerProvider) {
	s.signers = provider
}

func (s *Service) signRequest(target *server.Server, req *http.Request, body []byte) error {
	if s.signers == nil {
		return errors.New("berth cannot reach agents until its agent certificate authority is configured")
	}
	signer, err := s.signers.ClientSigner()
	if err != nil {
		return err
	}
	return signer.SignRequest(agentpki.AgentIdentity(target.ID), req, body)
}

func (s *Service) verifyResponse(target *server.Server, req *http.Request, resp *http.Response) error {
	verifier, err := s.signers.ResponseVerifier(target)
	if err != nil {
		return err
	}
	signer, err := s.signers.ClientSigner()
	if err != nil {
		return err
	}
	if _, err := agentsign.VerifyResponse(verifier, signer, req.Header.Get(agentsign.HeaderNonce), resp, agentsign.MaxBufferedResponseBytes); err != nil {
		s.logger.Warn("rejected a response that the agent did not sign",
			zap.Uint("server_id", target.ID),
			zap.String("server_name", target.Name),
			zap.Error(err),
		)
		_ = resp.Body.Close()
		return err
	}
	return nil
}

func NewService(logger *zap.Logger, operationTimeoutSeconds, readTimeoutSeconds int) *Service {
	return &Service{
		logger:           logger,
		operationTimeout: time.Duration(operationTimeoutSeconds) * time.Second,
		readTimeout:      time.Duration(readTimeoutSeconds) * time.Second,
	}
}

func (s *Service) getClient(server *server.Server, timeout time.Duration) *http.Client {
	client := &http.Client{
		Timeout: timeout,
	}

	if server.SkipSSLVerification != nil && *server.SkipSSLVerification {
		s.logger.Warn("SSL verification disabled for server",
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	return client
}

func (s *Service) MakeRequest(ctx context.Context, server *server.Server, method, endpoint string, payload any) (*http.Response, error) {
	return s.doRequest(ctx, server, method, endpoint, payload, s.operationTimeout, nil)
}
func (s *Service) MakeReadRequest(ctx context.Context, server *server.Server, method, endpoint string, payload any) (*http.Response, error) {
	return s.doRequest(ctx, server, method, endpoint, payload, s.readTimeout, nil)
}
func (s *Service) MakeReadRequestWithHeaders(ctx context.Context, server *server.Server, method, endpoint string, payload any, headers map[string]string) (*http.Response, error) {
	return s.doRequest(ctx, server, method, endpoint, payload, s.readTimeout, headers)
}
func (s *Service) MakeStreamRequestWithHeaders(ctx context.Context, server *server.Server, method, endpoint string, headers map[string]string) (*http.Response, error) {
	return s.doRequest(ctx, server, method, endpoint, nil, 0, headers)
}

func (s *Service) doRequest(ctx context.Context, server *server.Server, method, endpoint string, payload any, timeout time.Duration, headers map[string]string) (*http.Response, error) {
	url := server.GetAPIURL() + endpoint

	s.logger.Debug("making agent request",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.String("url", url),
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	var body io.Reader
	var signedBody []byte
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			s.logger.Error("failed to marshal request payload",
				zap.Error(err),
				zap.String("endpoint", endpoint),
				zap.Uint("server_id", server.ID),
			)
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
		signedBody = jsonData
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		s.logger.Error("failed to create HTTP request",
			zap.Error(err),
			zap.String("method", method),
			zap.String("url", url),
		)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+server.AccessToken)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for name, value := range headers {
		req.Header.Set(name, value)
	}
	if err := s.signRequest(server, req, signedBody); err != nil {
		return nil, err
	}

	client := s.getClient(server, timeout)
	resp, err := client.Do(req)
	if err != nil {
		s.logger.Error("agent request failed",
			zap.Error(err),
			zap.String("method", method),
			zap.String("endpoint", endpoint),
			zap.String("url", url),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return nil, fmt.Errorf("failed to make request to %s: %w", url, err)
	}

	if err := s.verifyResponse(server, req, resp); err != nil {
		return nil, err
	}

	s.logger.Info("agent request completed",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.Int("status_code", resp.StatusCode),
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	return resp, nil
}

func (s *Service) MakeMultipartRequest(ctx context.Context, server *server.Server, method, endpoint, path string, fileHeader *multipart.FileHeader) (*http.Response, error) {
	url := server.GetAPIURL() + endpoint

	s.logger.Debug("making multipart agent request",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.String("path", path),
		zap.String("filename", fileHeader.Filename),
		zap.Int64("file_size", fileHeader.Size),
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	file, err := fileHeader.Open()
	if err != nil {
		s.logger.Error("failed to open uploaded file",
			zap.Error(err),
			zap.String("filename", fileHeader.Filename),
			zap.Uint("server_id", server.ID),
		)
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", fileHeader.Filename)
	if err != nil {
		s.logger.Error("failed to create form file",
			zap.Error(err),
			zap.String("filename", fileHeader.Filename),
		)
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	_, err = io.Copy(part, file)
	if err != nil {
		s.logger.Error("failed to copy file data",
			zap.Error(err),
			zap.String("filename", fileHeader.Filename),
		)
		return nil, fmt.Errorf("failed to copy file data: %w", err)
	}

	err = writer.WriteField("path", path)
	if err != nil {
		s.logger.Error("failed to write path field",
			zap.Error(err),
			zap.String("path", path),
		)
		return nil, fmt.Errorf("failed to write path field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		s.logger.Error("failed to close multipart writer", zap.Error(err))
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, &body)
	if err != nil {
		s.logger.Error("failed to create multipart HTTP request",
			zap.Error(err),
			zap.String("method", method),
			zap.String("url", url),
		)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+server.AccessToken)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if err := s.signRequest(server, req, body.Bytes()); err != nil {
		return nil, err
	}

	client := s.getClient(server, s.operationTimeout)
	resp, err := client.Do(req)
	if err != nil {
		s.logger.Error("multipart agent request failed",
			zap.Error(err),
			zap.String("method", method),
			zap.String("endpoint", endpoint),
			zap.String("filename", fileHeader.Filename),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return nil, fmt.Errorf("failed to make request to %s: %w", url, err)
	}

	if err := s.verifyResponse(server, req, resp); err != nil {
		return nil, err
	}

	s.logger.Info("multipart agent request completed",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.String("filename", fileHeader.Filename),
		zap.Int64("file_size", fileHeader.Size),
		zap.Int("status_code", resp.StatusCode),
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	return resp, nil
}

func (s *Service) HealthCheck(ctx context.Context, server *server.Server) error {
	s.logger.Debug("performing health check",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	resp, err := s.MakeReadRequest(ctx, server, "GET", "/health", nil)
	if err != nil {
		s.logger.Error("health check request failed",
			zap.Error(err),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		s.logger.Warn("health check failed",
			zap.Int("status_code", resp.StatusCode),
			zap.Uint("server_id", server.ID),
			zap.String("server_name", server.Name),
		)
		return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
	}

	s.logger.Debug("health check passed",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	return nil
}
