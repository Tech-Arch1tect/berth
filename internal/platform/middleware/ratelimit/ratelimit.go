package ratelimit

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

type CountingMode string

const (
	CountAll    CountingMode = "all"
	CountNon2xx CountingMode = "non_2xx"
)

type Config struct {
	Store     *Store
	Name      string
	Rate      int
	Period    time.Duration
	CountMode CountingMode
	KeyFunc   func(echo.Context) string
}

func New(cfg Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			key := "rate_limit:" + cfg.Name + ":" + cfg.KeyFunc(c)
			now := time.Now()
			resetTime := now.Add(cfg.Period)

			count, existingReset, exists := cfg.Store.Get(key)
			if exists {
				resetTime = existingReset
			}

			if count >= cfg.Rate {
				writeHeaders(c, cfg.Rate, 0, resetTime)
				return echo.NewHTTPError(http.StatusTooManyRequests, "Too Many Requests")
			}

			var headerCount int
			if cfg.CountMode == CountAll {
				headerCount = cfg.Store.Increment(key, resetTime)
			} else {
				headerCount = count + 1
			}
			writeHeaders(c, cfg.Rate, cfg.Rate-headerCount, resetTime)

			err := next(c)

			if cfg.CountMode == CountNon2xx && c.Response().Status >= 300 {
				cfg.Store.Increment(key, resetTime)
			}
			return err
		}
	}
}

func writeHeaders(c echo.Context, limit, remaining int, reset time.Time) {
	if remaining < 0 {
		remaining = 0
	}
	h := c.Response().Header()
	h.Set("X-RateLimit-Limit", strconv.Itoa(limit))
	h.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	h.Set("X-RateLimit-Reset", strconv.FormatInt(reset.Unix(), 10))
}

func KeyByIP(c echo.Context) string {
	ip := c.RealIP()
	if ip == "" || ip == "unknown" {
		ip = "fallback"
	}
	return ip
}

type Store struct {
	mu   sync.Mutex
	data map[string]*entry
}

type entry struct {
	count     int
	resetTime time.Time
}

func NewStore() *Store {
	s := &Store{data: make(map[string]*entry)}
	go s.cleanupLoop()
	return s
}

func (s *Store) Get(key string) (count int, resetTime time.Time, exists bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.data[key]; ok && time.Now().Before(e.resetTime) {
		return e.count, e.resetTime, true
	}
	return 0, time.Time{}, false
}

func (s *Store) Increment(key string, resetTime time.Time) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.data[key]; ok && time.Now().Before(e.resetTime) {
		e.count++
		return e.count
	}
	s.data[key] = &entry{count: 1, resetTime: resetTime}
	return 1
}

func (s *Store) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for k, e := range s.data {
			if now.After(e.resetTime) {
				delete(s.data, k)
			}
		}
		s.mu.Unlock()
	}
}
