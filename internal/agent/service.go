package agent

import (
	"berth/models"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type Service struct {
	logger *logging.Service
}

func NewService(logger *logging.Service) *Service {
	return &Service{
		logger: logger,
	}
}

func (s *Service) getClient(server *models.Server) *http.Client {
	client := &http.Client{
		Timeout: 30 * time.Second,
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

func (s *Service) MakeRequest(ctx context.Context, server *models.Server, method, endpoint string, payload any) (*http.Response, error) {
	url := server.GetAPIURL() + endpoint

	s.logger.Debug("making agent request",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.String("url", url),
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	var body io.Reader
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

	client := s.getClient(server)
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

	s.logger.Info("agent request completed",
		zap.String("method", method),
		zap.String("endpoint", endpoint),
		zap.Int("status_code", resp.StatusCode),
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	return resp, nil
}

func (s *Service) MakeMultipartRequest(ctx context.Context, server *models.Server, method, endpoint, path string, fileHeader *multipart.FileHeader) (*http.Response, error) {
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

	client := s.getClient(server)
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

func (s *Service) HealthCheck(ctx context.Context, server *models.Server) error {
	s.logger.Debug("performing health check",
		zap.Uint("server_id", server.ID),
		zap.String("server_name", server.Name),
	)

	resp, err := s.MakeRequest(ctx, server, "GET", "/health", nil)
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
