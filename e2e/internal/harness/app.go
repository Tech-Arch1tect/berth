package harness

import "net/http"

type HTTPClient struct {
	Client  *http.Client
	BaseURL string
}
