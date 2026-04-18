package harness

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"sync"

	"github.com/labstack/echo/v4"
)

type RouteInfo struct {
	Method   string `json:"method"`
	Path     string `json:"path"`
	Name     string `json:"name"`
	HitCount int    `json:"hit_count,omitempty"`
}

type CoverageStats struct {
	TotalRoutes   int
	CoveredRoutes int
	MissingRoutes []RouteInfo
	Coverage      float64
}

type CoverageTracker struct {
	mu               sync.RWMutex
	registeredRoutes map[string]RouteInfo
	hitRoutes        map[string]int
	excludePatterns  []string
}

func NewCoverageTracker() *CoverageTracker {
	return &CoverageTracker{
		registeredRoutes: make(map[string]RouteInfo),
		hitRoutes:        make(map[string]int),
		excludePatterns: []string{

			"github.com/labstack/echo/v4",
		},
	}
}

func routeKey(method, path string) string {
	return method + ":" + path
}

func (ct *CoverageTracker) RegisterRoutes(e *echo.Echo) {
	ct.mu.Lock()
	defer ct.mu.Unlock()

	routes := e.Routes()
	for _, route := range routes {

		skip := false
		for _, pattern := range ct.excludePatterns {
			if strings.Contains(route.Name, pattern) {
				skip = true
				break
			}
		}
		if skip {
			continue
		}

		key := routeKey(route.Method, route.Path)
		ct.registeredRoutes[key] = RouteInfo{
			Method: route.Method,
			Path:   route.Path,
			Name:   route.Name,
		}
	}
}

func (ct *CoverageTracker) AddExcludePattern(pattern string) {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	ct.excludePatterns = append(ct.excludePatterns, pattern)
}

func (ct *CoverageTracker) TrackingMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {

			method := c.Request().Method
			path := c.Path()

			ct.mu.Lock()
			key := routeKey(method, path)
			ct.hitRoutes[key]++
			ct.mu.Unlock()

			return next(c)
		}
	}
}

func (ct *CoverageTracker) RecordHit(method, path string) {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	key := routeKey(method, path)
	ct.hitRoutes[key]++
}

func (ct *CoverageTracker) GetStats() CoverageStats {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	var missing []RouteInfo
	covered := 0

	for key, route := range ct.registeredRoutes {
		if ct.hitRoutes[key] > 0 {
			covered++
		} else {
			missing = append(missing, route)
		}
	}

	sort.Slice(missing, func(i, j int) bool {
		if missing[i].Path == missing[j].Path {
			return missing[i].Method < missing[j].Method
		}
		return missing[i].Path < missing[j].Path
	})

	total := len(ct.registeredRoutes)
	var coverage float64
	if total > 0 {
		coverage = float64(covered) / float64(total) * 100
	}

	return CoverageStats{
		TotalRoutes:   total,
		CoveredRoutes: covered,
		MissingRoutes: missing,
		Coverage:      coverage,
	}
}

func (ct *CoverageTracker) GetCoveredRoutes() []RouteInfo {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	var covered []RouteInfo
	for key, route := range ct.registeredRoutes {
		if hitCount := ct.hitRoutes[key]; hitCount > 0 {
			routeWithCount := RouteInfo{
				Method:   route.Method,
				Path:     route.Path,
				Name:     route.Name,
				HitCount: hitCount,
			}
			covered = append(covered, routeWithCount)
		}
	}

	sort.Slice(covered, func(i, j int) bool {
		if covered[i].Path == covered[j].Path {
			return covered[i].Method < covered[j].Method
		}
		return covered[i].Path < covered[j].Path
	})

	return covered
}

func (ct *CoverageTracker) PrintReport() {
	ct.PrintReportTo(os.Stderr)
}

func (ct *CoverageTracker) PrintReportTo(w io.Writer) {
	stats := ct.GetStats()
	covered := ct.GetCoveredRoutes()

	fmt.Fprintf(w, "\n")
	fmt.Fprintf(w, "╔══════════════════════════════════════════════════════════════╗\n")
	fmt.Fprintf(w, "║                  API ENDPOINT COVERAGE REPORT                 ║\n")
	fmt.Fprintf(w, "╠══════════════════════════════════════════════════════════════╣\n")
	fmt.Fprintf(w, "║  Total Endpoints:    %4d                                     ║\n", stats.TotalRoutes)
	fmt.Fprintf(w, "║  Covered Endpoints:  %4d                                     ║\n", stats.CoveredRoutes)
	fmt.Fprintf(w, "║  Missing Endpoints:  %4d                                     ║\n", len(stats.MissingRoutes))
	fmt.Fprintf(w, "║  Coverage:           %5.1f%%                                   ║\n", stats.Coverage)
	fmt.Fprintf(w, "╚══════════════════════════════════════════════════════════════╝\n")

	if len(covered) > 0 {
		fmt.Fprintf(w, "\nCOVERED ENDPOINTS (with test counts):\n")
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
		for _, route := range covered {
			fmt.Fprintf(w, "  %-7s %-50s  [%d tests]\n", route.Method, route.Path, route.HitCount)
		}
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
	}

	if len(stats.MissingRoutes) > 0 {
		fmt.Fprintf(w, "\nMISSING TEST COVERAGE:\n")
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
		for _, route := range stats.MissingRoutes {
			fmt.Fprintf(w, "  %-7s %s\n", route.Method, route.Path)
		}
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
	}

	fmt.Fprintf(w, "\n")
}

func (ct *CoverageTracker) WriteReportToFile(filename string) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create coverage report file: %w", err)
	}
	defer f.Close()

	ct.PrintReportTo(f)
	return nil
}

func (ct *CoverageTracker) WriteJSONReport(filename string) error {
	stats := ct.GetStats()

	type JSONReport struct {
		TotalRoutes      int         `json:"total_routes"`
		CoveredCount     int         `json:"covered_count"`
		MissingCount     int         `json:"missing_count"`
		CoveragePercent  float64     `json:"coverage_percent"`
		MissingRoutes    []RouteInfo `json:"missing_routes"`
		CoveredRouteList []RouteInfo `json:"covered_routes"`
	}

	report := JSONReport{
		TotalRoutes:      stats.TotalRoutes,
		CoveredCount:     stats.CoveredRoutes,
		MissingCount:     len(stats.MissingRoutes),
		CoveragePercent:  stats.Coverage,
		MissingRoutes:    stats.MissingRoutes,
		CoveredRouteList: ct.GetCoveredRoutes(),
	}

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal coverage report: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write coverage report: %w", err)
	}

	return nil
}

func (ct *CoverageTracker) Reset() {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	ct.hitRoutes = make(map[string]int)
}
