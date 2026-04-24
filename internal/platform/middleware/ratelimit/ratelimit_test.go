package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestEcho() *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	return e
}

func sendN(t *testing.T, e *echo.Echo, path string, n int) []*httptest.ResponseRecorder {
	t.Helper()
	out := make([]*httptest.ResponseRecorder, n)
	for i := 0; i < n; i++ {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = "10.0.0.1:1234"
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		out[i] = rec
	}
	return out
}

func TestCountAllBlocksAtLimit(t *testing.T) {
	e := newTestEcho()
	e.GET("/x", func(c echo.Context) error { return c.String(http.StatusOK, "ok") },
		New(Config{Store: NewStore(), Rate: 3, Period: time.Minute, CountMode: CountAll, KeyFunc: KeyByIP}))

	recs := sendN(t, e, "/x", 4)
	assert.Equal(t, http.StatusOK, recs[0].Code)
	assert.Equal(t, http.StatusOK, recs[1].Code)
	assert.Equal(t, http.StatusOK, recs[2].Code)
	assert.Equal(t, http.StatusTooManyRequests, recs[3].Code)
}

func TestCountNon2xxAllowsExactlyRateFailures(t *testing.T) {
	e := newTestEcho()
	e.GET("/fail", func(c echo.Context) error { return c.String(http.StatusUnauthorized, "bad") },
		New(Config{Store: NewStore(), Rate: 5, Period: time.Minute, CountMode: CountNon2xx, KeyFunc: KeyByIP}))

	recs := sendN(t, e, "/fail", 6)
	for i := 0; i < 5; i++ {
		assert.Equal(t, http.StatusUnauthorized, recs[i].Code, "failure %d must pass", i+1)
	}
	assert.Equal(t, http.StatusTooManyRequests, recs[5].Code)
}

func TestCountNon2xxDoesNotCountSuccesses(t *testing.T) {
	e := newTestEcho()
	e.GET("/ok", func(c echo.Context) error { return c.String(http.StatusOK, "ok") },
		New(Config{Store: NewStore(), Rate: 2, Period: time.Minute, CountMode: CountNon2xx, KeyFunc: KeyByIP}))

	recs := sendN(t, e, "/ok", 10)
	for i, r := range recs {
		assert.Equal(t, http.StatusOK, r.Code, "success %d must never be rate limited", i+1)
	}
}

func TestCountNon2xxCountsRedirectsAsFailures(t *testing.T) {
	e := newTestEcho()
	e.GET("/r", func(c echo.Context) error { return c.Redirect(http.StatusFound, "/elsewhere") },
		New(Config{Store: NewStore(), Rate: 3, Period: time.Minute, CountMode: CountNon2xx, KeyFunc: KeyByIP}))

	recs := sendN(t, e, "/r", 4)
	assert.Equal(t, http.StatusFound, recs[0].Code)
	assert.Equal(t, http.StatusFound, recs[1].Code)
	assert.Equal(t, http.StatusFound, recs[2].Code)
	assert.Equal(t, http.StatusTooManyRequests, recs[3].Code)
}

func TestCountNon2xxDoesNotCount2xx(t *testing.T) {
	e := newTestEcho()
	e.GET("/ok", func(c echo.Context) error { return c.String(http.StatusOK, "ok") },
		New(Config{Store: NewStore(), Rate: 2, Period: time.Minute, CountMode: CountNon2xx, KeyFunc: KeyByIP}))
	e.GET("/created", func(c echo.Context) error { return c.String(http.StatusCreated, "ok") },
		New(Config{Store: NewStore(), Rate: 2, Period: time.Minute, CountMode: CountNon2xx, KeyFunc: KeyByIP}))

	for i := 0; i < 20; i++ {
		require.Equal(t, http.StatusOK, sendN(t, e, "/ok", 1)[0].Code)
	}
	for i := 0; i < 20; i++ {
		require.Equal(t, http.StatusCreated, sendN(t, e, "/created", 1)[0].Code)
	}
}

func TestRateLimitHeaders(t *testing.T) {
	e := newTestEcho()
	e.GET("/h", func(c echo.Context) error { return c.String(http.StatusOK, "ok") },
		New(Config{Store: NewStore(), Rate: 3, Period: time.Minute, CountMode: CountAll, KeyFunc: KeyByIP}))

	recs := sendN(t, e, "/h", 4)
	for _, r := range recs {
		assert.Equal(t, "3", r.Header().Get("X-RateLimit-Limit"))
		assert.NotEmpty(t, r.Header().Get("X-RateLimit-Reset"))
	}
	assert.Equal(t, "2", recs[0].Header().Get("X-RateLimit-Remaining"))
	assert.Equal(t, "1", recs[1].Header().Get("X-RateLimit-Remaining"))
	assert.Equal(t, "0", recs[2].Header().Get("X-RateLimit-Remaining"))
	assert.Equal(t, "0", recs[3].Header().Get("X-RateLimit-Remaining"))

	reset, err := strconv.ParseInt(recs[0].Header().Get("X-RateLimit-Reset"), 10, 64)
	require.NoError(t, err)
	assert.True(t, reset > time.Now().Unix())
}

func TestWindowResetsAfterPeriod(t *testing.T) {
	e := newTestEcho()
	e.GET("/r", func(c echo.Context) error { return c.String(http.StatusOK, "ok") },
		New(Config{Store: NewStore(), Rate: 2, Period: 50 * time.Millisecond, CountMode: CountAll, KeyFunc: KeyByIP}))

	recs := sendN(t, e, "/r", 3)
	require.Equal(t, http.StatusOK, recs[0].Code)
	require.Equal(t, http.StatusOK, recs[1].Code)
	require.Equal(t, http.StatusTooManyRequests, recs[2].Code)

	time.Sleep(80 * time.Millisecond)

	assert.Equal(t, http.StatusOK, sendN(t, e, "/r", 1)[0].Code)
}

func TestKeyByIPSeparatesByIP(t *testing.T) {
	e := newTestEcho()
	e.GET("/i", func(c echo.Context) error { return c.String(http.StatusOK, "ok") },
		New(Config{Store: NewStore(), Rate: 1, Period: time.Minute, CountMode: CountAll, KeyFunc: KeyByIP}))

	send := func(ip string) int {
		req := httptest.NewRequest(http.MethodGet, "/i", nil)
		req.RemoteAddr = ip + ":1"
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec.Code
	}
	assert.Equal(t, http.StatusOK, send("1.1.1.1"))
	assert.Equal(t, http.StatusTooManyRequests, send("1.1.1.1"))
	assert.Equal(t, http.StatusOK, send("2.2.2.2"))
}

func TestKeyByIPIgnoresUserAgent(t *testing.T) {
	e := newTestEcho()
	e.GET("/s", func(c echo.Context) error { return c.String(http.StatusOK, "ok") },
		New(Config{Store: NewStore(), Rate: 2, Period: time.Minute, CountMode: CountAll, KeyFunc: KeyByIP}))

	send := func(ua string) int {
		req := httptest.NewRequest(http.MethodGet, "/s", nil)
		req.RemoteAddr = "3.3.3.3:1"
		req.Header.Set("User-Agent", ua)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec.Code
	}
	assert.Equal(t, http.StatusOK, send("browser-a"))
	assert.Equal(t, http.StatusOK, send("browser-b"))
	assert.Equal(t, http.StatusTooManyRequests, send("browser-c"),
		"rotating User-Agent must NOT grant an attacker an independent bucket")
}

func TestStoreGetExpiredReturnsZero(t *testing.T) {
	s := NewStore()
	s.data["k"] = &entry{count: 7, resetTime: time.Now().Add(20 * time.Millisecond)}

	c, _, exists := s.Get("k")
	require.True(t, exists)
	require.Equal(t, 7, c)

	time.Sleep(40 * time.Millisecond)
	c, _, exists = s.Get("k")
	assert.False(t, exists)
	assert.Equal(t, 0, c)
}

func TestStoreIncrementAtomic(t *testing.T) {
	s := NewStore()
	reset := time.Now().Add(time.Minute)
	const n = 200
	done := make(chan struct{}, n)
	for i := 0; i < n; i++ {
		go func() {
			s.Increment("k", reset)
			done <- struct{}{}
		}()
	}
	for i := 0; i < n; i++ {
		<-done
	}
	c, _, _ := s.Get("k")
	assert.Equal(t, n, c, "Increment must be atomic")
}
