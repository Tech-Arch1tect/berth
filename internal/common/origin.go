package common

import (
	"net/http"
	"net/url"
)

type CheckOriginFunc func(r *http.Request) bool

func NewOriginChecker(appURL string) CheckOriginFunc {
	parsed, err := url.Parse(appURL)
	if err != nil || parsed.Host == "" {
		return func(r *http.Request) bool {
			return false
		}
	}

	allowedOrigin := parsed.Scheme + "://" + parsed.Host

	return func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		return origin == allowedOrigin
	}
}
