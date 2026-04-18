package harness

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

const csrfCookieName = "_csrf"

type RequestOptions struct {
	Method      string
	Path        string
	Body        interface{}
	Headers     map[string]string
	Cookies     []*http.Cookie
	ContentType string
	FormData    url.Values
}

func isSafeHTTPMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodTrace, "":
		return true
	}
	return false
}

func csrfTokenFromJar(jar http.CookieJar, baseURL string) string {
	if jar == nil || baseURL == "" {
		return ""
	}
	u, err := url.Parse(baseURL)
	if err != nil {
		return ""
	}
	for _, ck := range jar.Cookies(u) {
		if ck.Name == csrfCookieName {
			return ck.Value
		}
	}
	return ""
}

type Response struct {
	*http.Response
	Body []byte
}

func (r *Response) GetJSON(v interface{}) error {
	return json.Unmarshal(r.Body, v)
}

func (r *Response) GetString() string {
	return string(r.Body)
}

func (r *Response) AssertStatus(t *testing.T, expectedStatus int) {
	require.Equal(t, expectedStatus, r.StatusCode, "unexpected status code. Response: %s", r.GetString())
}

func (r *Response) AssertRedirect(t *testing.T, expectedLocation string) {
	require.True(t, r.StatusCode >= 300 && r.StatusCode < 400, "expected redirect status code")
	location := r.Header.Get("Location")
	require.Equal(t, expectedLocation, location)
}

func (r *Response) AssertContains(t *testing.T, expectedText string) {
	body := r.GetString()
	require.Contains(t, body, expectedText, "response body does not contain expected text")
}

func (r *Response) AssertNotContains(t *testing.T, unexpectedText string) {
	body := r.GetString()
	require.NotContains(t, body, unexpectedText, "response body contains unexpected text")
}

func (c *HTTPClient) Get(path string) (*Response, error) {
	return c.Request(&RequestOptions{
		Method: "GET",
		Path:   path,
	})
}

func (c *HTTPClient) Post(path string, body interface{}) (*Response, error) {
	return c.Request(&RequestOptions{
		Method: "POST",
		Path:   path,
		Body:   body,
	})
}

func (c *HTTPClient) PostForm(path string, data url.Values) (*Response, error) {
	return c.Request(&RequestOptions{
		Method:   "POST",
		Path:     path,
		FormData: data,
	})
}

func (c *HTTPClient) Put(path string, body interface{}) (*Response, error) {
	return c.Request(&RequestOptions{
		Method: "PUT",
		Path:   path,
		Body:   body,
	})
}

func (c *HTTPClient) Patch(path string, body interface{}) (*Response, error) {
	return c.Request(&RequestOptions{
		Method: "PATCH",
		Path:   path,
		Body:   body,
	})
}

func (c *HTTPClient) Delete(path string) (*Response, error) {
	return c.Request(&RequestOptions{
		Method: "DELETE",
		Path:   path,
	})
}

func (c *HTTPClient) DeleteWithBody(path string, body interface{}) (*Response, error) {
	return c.Request(&RequestOptions{
		Method: "DELETE",
		Path:   path,
		Body:   body,
	})
}

func (c *HTTPClient) Request(opts *RequestOptions) (*Response, error) {
	fullURL := c.BaseURL + opts.Path

	var bodyReader io.Reader
	contentType := opts.ContentType

	if opts.FormData != nil {
		bodyReader = strings.NewReader(opts.FormData.Encode())
		if contentType == "" {
			contentType = "application/x-www-form-urlencoded"
		}
	} else if opts.Body != nil {
		jsonBody, err := json.Marshal(opts.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
		if contentType == "" {
			contentType = "application/json"
		}
	}

	req, err := http.NewRequest(opts.Method, fullURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	for key, value := range opts.Headers {
		req.Header.Set(key, value)
	}

	for _, cookie := range opts.Cookies {
		req.AddCookie(cookie)
	}

	if !isSafeHTTPMethod(opts.Method) && req.Header.Get("X-CSRF-Token") == "" {
		if token := csrfTokenFromJar(c.Client.Jar, c.BaseURL); token != "" {
			req.Header.Set("X-CSRF-Token", token)
		}
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return &Response{
		Response: resp,
		Body:     body,
	}, nil
}

func (c *HTTPClient) WithCookieJar() *HTTPClient {
	jar, _ := cookiejar.New(nil)
	newClient := &http.Client{
		Timeout: c.Client.Timeout,
		Jar:     jar,
	}

	return &HTTPClient{
		Client:  newClient,
		BaseURL: c.BaseURL,
	}
}

func (c *HTTPClient) EnsureCookieJar() *HTTPClient {
	if c.Client.Jar != nil {
		return &HTTPClient{
			Client:  c.Client,
			BaseURL: c.BaseURL,
		}
	}

	return c.WithCookieJar()
}

func (c *HTTPClient) WithoutRedirects() *HTTPClient {
	newClient := &http.Client{
		Timeout: c.Client.Timeout,
		Jar:     c.Client.Jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	return &HTTPClient{
		Client:  newClient,
		BaseURL: c.BaseURL,
	}
}
