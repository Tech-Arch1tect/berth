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
			freshReset := time.Now().Add(cfg.Period)

			if cfg.CountMode == CountAll {
				allowed, count, reset := cfg.Store.Allow(key, cfg.Rate, freshReset)
				if !allowed {
					writeHeaders(c, cfg.Rate, 0, reset)
					return echo.NewHTTPError(http.StatusTooManyRequests, "Too Many Requests")
				}
				writeHeaders(c, cfg.Rate, cfg.Rate-count, reset)
				return next(c)
			}

			count, existingReset, exists := cfg.Store.Get(key)
			resetTime := freshReset
			if exists {
				resetTime = existingReset
			}

			if count >= cfg.Rate {
				writeHeaders(c, cfg.Rate, 0, resetTime)
				return echo.NewHTTPError(http.StatusTooManyRequests, "Too Many Requests")
			}
			writeHeaders(c, cfg.Rate, cfg.Rate-(count+1), resetTime)

			err := next(c)

			if c.Response().Status >= 300 {
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
	mu       sync.Mutex
	data     map[string]*entry
	stop     chan struct{}
	stopOnce sync.Once
}

type entry struct {
	count     int
	resetTime time.Time
}

func NewStore() *Store {
	s := &Store{data: make(map[string]*entry), stop: make(chan struct{})}
	go s.cleanupLoop()
	return s
}

func (s *Store) Stop() {
	s.stopOnce.Do(func() { close(s.stop) })
}

func (s *Store) Get(key string) (count int, resetTime time.Time, exists bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.data[key]; ok && time.Now().Before(e.resetTime) {
		return e.count, e.resetTime, true
	}
	return 0, time.Time{}, false
}

func (s *Store) Allow(key string, rate int, resetTime time.Time) (allowed bool, count int, reset time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.data[key]; ok && time.Now().Before(e.resetTime) {
		if e.count >= rate {
			return false, e.count, e.resetTime
		}
		e.count++
		return true, e.count, e.resetTime
	}
	s.data[key] = &entry{count: 1, resetTime: resetTime}
	return true, 1, resetTime
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
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
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
}
