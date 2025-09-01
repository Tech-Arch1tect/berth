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
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) getClient(server *models.Server) *http.Client {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	if server.SkipSSLVerification != nil && *server.SkipSSLVerification {
		client.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	return client
}

func (s *Service) MakeRequest(ctx context.Context, server *models.Server, method, endpoint string, payload any) (*http.Response, error) {
	url := server.GetAPIURL() + endpoint

	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+server.AccessToken)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	client := s.getClient(server)
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to %s: %w", url, err)
	}

	return resp, nil
}

func (s *Service) MakeMultipartRequest(ctx context.Context, server *models.Server, method, endpoint, path string, fileHeader *multipart.FileHeader) (*http.Response, error) {
	url := server.GetAPIURL() + endpoint

	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", fileHeader.Filename)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	_, err = io.Copy(part, file)
	if err != nil {
		return nil, fmt.Errorf("failed to copy file data: %w", err)
	}

	err = writer.WriteField("path", path)
	if err != nil {
		return nil, fmt.Errorf("failed to write path field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+server.AccessToken)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := s.getClient(server)
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to %s: %w", url, err)
	}

	return resp, nil
}

func (s *Service) HealthCheck(ctx context.Context, server *models.Server) error {
	resp, err := s.MakeRequest(ctx, server, "GET", "/health", nil)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed with status: %d", resp.StatusCode)
	}

	return nil
}
