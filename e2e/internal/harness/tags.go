package harness

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"sync"
)

const (
	CategoryNoAuth        = "no_auth"
	CategoryHappyPath     = "happy_path"
	CategoryValidation    = "validation"
	CategoryErrorHandler  = "error_handling"
	CategoryAuthorization = "authorization"
	CategoryEdgeCase      = "edge_case"
	CategoryIntegration   = "integration"
	CategorySecurity      = "security"
	CategoryUnspecified   = "unspecified"
)

const (
	ValueLow         = "low"
	ValueMedium      = "medium"
	ValueHigh        = "high"
	ValueUnspecified = "unspecified"
)

type TestTag struct {
	TestName string `json:"test_name"`
	Route    string `json:"route"`
	Category string `json:"category"`
	Value    string `json:"value"`
}

type RouteTestQuality struct {
	Route      string         `json:"route"`
	TotalTests int            `json:"total_tests"`
	ByCategory map[string]int `json:"by_category"`
	ByValue    map[string]int `json:"by_value"`
	Tests      []TestTag      `json:"tests"`
	Score      float64        `json:"quality_score"`
}

type TestQualityStats struct {
	TotalTests          int                          `json:"total_tests"`
	ByCategory          map[string]int               `json:"by_category"`
	ByValue             map[string]int               `json:"by_value"`
	RouteQuality        map[string]*RouteTestQuality `json:"route_quality"`
	AverageScore        float64                      `json:"average_score"`
	LowQualityRoutes    []string                     `json:"low_quality_routes"`
	UnspecifiedCategory int                          `json:"unspecified_category"`
	UnspecifiedValue    int                          `json:"unspecified_value"`
	UntaggedRoutes      []string                     `json:"untagged_routes"`
}

type TestTagTracker struct {
	mu   sync.RWMutex
	tags []TestTag
}

var (
	globalTestTagTracker     *TestTagTracker
	globalTestTagTrackerOnce sync.Once
)

func GetTestTagTracker() *TestTagTracker {
	globalTestTagTrackerOnce.Do(func() {
		globalTestTagTracker = NewTestTagTracker()
	})
	return globalTestTagTracker
}

func NewTestTagTracker() *TestTagTracker {
	return &TestTagTracker{
		tags: make([]TestTag, 0),
	}
}

func TagTest(t interface{ Name() string }, method, path, category, value string) {

	if category == "" {
		category = CategoryUnspecified
	}
	if value == "" {
		value = ValueUnspecified
	}

	tracker := GetTestTagTracker()
	tracker.Add(TestTag{
		TestName: t.Name(),
		Route:    method + " " + path,
		Category: category,
		Value:    value,
	})
}

func TagTestRoute(t interface{ Name() string }, method, path string) {
	TagTest(t, method, path, CategoryUnspecified, ValueUnspecified)
}

func TagTestCategory(t interface{ Name() string }, method, path, category string) {
	TagTest(t, method, path, category, ValueUnspecified)
}

func (tt *TestTagTracker) Add(tag TestTag) {
	tt.mu.Lock()
	defer tt.mu.Unlock()
	tt.tags = append(tt.tags, tag)
}

func (tt *TestTagTracker) GetStats() TestQualityStats {
	tt.mu.RLock()
	defer tt.mu.RUnlock()

	stats := TestQualityStats{
		TotalTests:   len(tt.tags),
		ByCategory:   make(map[string]int),
		ByValue:      make(map[string]int),
		RouteQuality: make(map[string]*RouteTestQuality),
	}

	for _, tag := range tt.tags {
		stats.ByCategory[tag.Category]++
		stats.ByValue[tag.Value]++

		if tag.Category == CategoryUnspecified {
			stats.UnspecifiedCategory++
		}
		if tag.Value == ValueUnspecified {
			stats.UnspecifiedValue++
		}

		if _, exists := stats.RouteQuality[tag.Route]; !exists {
			stats.RouteQuality[tag.Route] = &RouteTestQuality{
				Route:      tag.Route,
				ByCategory: make(map[string]int),
				ByValue:    make(map[string]int),
				Tests:      make([]TestTag, 0),
			}
		}
		rq := stats.RouteQuality[tag.Route]
		rq.TotalTests++
		rq.ByCategory[tag.Category]++
		rq.ByValue[tag.Value]++
		rq.Tests = append(rq.Tests, tag)
	}

	var totalScore float64
	for _, rq := range stats.RouteQuality {
		rq.Score = calculateRouteQualityScore(rq)
		totalScore += rq.Score

		if rq.Score < 30 {
			stats.LowQualityRoutes = append(stats.LowQualityRoutes, rq.Route)
		}
	}

	if len(stats.RouteQuality) > 0 {
		stats.AverageScore = totalScore / float64(len(stats.RouteQuality))
	}

	sort.Strings(stats.LowQualityRoutes)

	return stats
}

func (tt *TestTagTracker) GetStatsWithCoverage(coverage *CoverageTracker) TestQualityStats {
	stats := tt.GetStats()

	if coverage == nil {
		return stats
	}

	taggedRoutes := make(map[string]bool)
	for route := range stats.RouteQuality {
		taggedRoutes[route] = true
	}

	coveredRoutes := coverage.GetCoveredRoutes()
	for _, route := range coveredRoutes {
		routeKey := route.Method + " " + route.Path
		if !taggedRoutes[routeKey] {
			stats.UntaggedRoutes = append(stats.UntaggedRoutes, routeKey)
		}
	}

	sort.Strings(stats.UntaggedRoutes)

	return stats
}

func calculateRouteQualityScore(rq *RouteTestQuality) float64 {
	if rq.TotalTests == 0 {
		return 0
	}

	var score float64

	categoryCount := len(rq.ByCategory)
	if categoryCount >= 4 {
		score += 40
	} else if categoryCount >= 3 {
		score += 30
	} else if categoryCount >= 2 {
		score += 20
	} else {
		score += 10
	}

	if categoryCount == 1 && rq.ByCategory[CategoryNoAuth] > 0 {
		score -= 10
	}

	highCount := rq.ByValue[ValueHigh]
	mediumCount := rq.ByValue[ValueMedium]
	lowCount := rq.ByValue[ValueLow]

	if highCount > 0 {
		score += 20
	}
	if mediumCount > 0 {
		score += 15
	}
	if lowCount > 0 && (highCount > 0 || mediumCount > 0) {
		score += 5
	}

	if rq.ByCategory[CategoryHappyPath] > 0 {
		score += 20
	}

	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	return score
}

func (tt *TestTagTracker) PrintReport() {
	tt.PrintReportTo(os.Stderr)
}

func (tt *TestTagTracker) PrintReportTo(w io.Writer) {
	tt.PrintReportToWithCoverage(w, nil)
}

func (tt *TestTagTracker) PrintReportToWithCoverage(w io.Writer, coverage *CoverageTracker) {
	var stats TestQualityStats
	if coverage != nil {
		stats = tt.GetStatsWithCoverage(coverage)
	} else {
		stats = tt.GetStats()
	}

	fmt.Fprintf(w, "\n")
	fmt.Fprintf(w, "╔══════════════════════════════════════════════════════════════╗\n")
	fmt.Fprintf(w, "║                   TEST QUALITY REPORT                         ║\n")
	fmt.Fprintf(w, "╠══════════════════════════════════════════════════════════════╣\n")
	fmt.Fprintf(w, "║  Tagged Tests:       %4d                                     ║\n", stats.TotalTests)
	fmt.Fprintf(w, "║  Routes with Tags:   %4d                                     ║\n", len(stats.RouteQuality))
	fmt.Fprintf(w, "║  Average Quality:    %5.1f                                    ║\n", stats.AverageScore)
	fmt.Fprintf(w, "╚══════════════════════════════════════════════════════════════╝\n")

	if stats.UnspecifiedCategory > 0 || stats.UnspecifiedValue > 0 {
		fmt.Fprintf(w, "\nWARNINGS:\n")
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
		if stats.UnspecifiedCategory > 0 {
			fmt.Fprintf(w, "  %d tests missing category\n", stats.UnspecifiedCategory)
		}
		if stats.UnspecifiedValue > 0 {
			fmt.Fprintf(w, "  %d tests missing value\n", stats.UnspecifiedValue)
		}
	}

	if len(stats.UntaggedRoutes) > 0 {
		fmt.Fprintf(w, "\nUNTAGGED ROUTES (covered but no quality tags):\n")
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
		for _, route := range stats.UntaggedRoutes {
			fmt.Fprintf(w, "  %s\n", route)
		}
	}

	fmt.Fprintf(w, "\nTESTS BY CATEGORY:\n")
	fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
	categories := []string{CategoryHappyPath, CategoryValidation, CategoryErrorHandler,
		CategoryAuthorization, CategoryNoAuth, CategoryEdgeCase, CategoryIntegration, CategorySecurity, CategoryUnspecified}
	for _, cat := range categories {
		if count := stats.ByCategory[cat]; count > 0 {
			fmt.Fprintf(w, "  %-20s %d\n", cat, count)
		}
	}

	fmt.Fprintf(w, "\nTESTS BY VALUE:\n")
	fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
	fmt.Fprintf(w, "  %-20s %d\n", "high", stats.ByValue[ValueHigh])
	fmt.Fprintf(w, "  %-20s %d\n", "medium", stats.ByValue[ValueMedium])
	fmt.Fprintf(w, "  %-20s %d\n", "low", stats.ByValue[ValueLow])
	if stats.ByValue[ValueUnspecified] > 0 {
		fmt.Fprintf(w, "  %-20s %d\n", "unspecified", stats.ByValue[ValueUnspecified])
	}

	if len(stats.LowQualityRoutes) > 0 {
		fmt.Fprintf(w, "\nLOW QUALITY ROUTES (score < 30):\n")
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")
		for _, route := range stats.LowQualityRoutes {
			rq := stats.RouteQuality[route]
			fmt.Fprintf(w, "  %-50s  [score: %.0f]\n", route, rq.Score)
		}
	}

	if len(stats.RouteQuality) > 0 {
		fmt.Fprintf(w, "\nROUTE QUALITY DETAILS:\n")
		fmt.Fprintf(w, "────────────────────────────────────────────────────────────────\n")

		routes := make([]string, 0, len(stats.RouteQuality))
		for route := range stats.RouteQuality {
			routes = append(routes, route)
		}
		sort.Slice(routes, func(i, j int) bool {
			return stats.RouteQuality[routes[i]].Score < stats.RouteQuality[routes[j]].Score
		})

		for _, route := range routes {
			rq := stats.RouteQuality[route]
			fmt.Fprintf(w, "  %-50s  [%d tests, score: %.0f]\n", route, rq.TotalTests, rq.Score)

			for cat, count := range rq.ByCategory {
				fmt.Fprintf(w, "      - %s: %d\n", cat, count)
			}
		}
	}

	fmt.Fprintf(w, "\n")
}

func (tt *TestTagTracker) WriteReportToFile(filename string) error {
	return tt.WriteReportToFileWithCoverage(filename, nil)
}

func (tt *TestTagTracker) WriteReportToFileWithCoverage(filename string, coverage *CoverageTracker) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create test quality report file: %w", err)
	}
	defer f.Close()

	tt.PrintReportToWithCoverage(f, coverage)
	return nil
}

func (tt *TestTagTracker) WriteJSONReport(filename string) error {
	return tt.WriteJSONReportWithCoverage(filename, nil)
}

func (tt *TestTagTracker) WriteJSONReportWithCoverage(filename string, coverage *CoverageTracker) error {
	var stats TestQualityStats
	if coverage != nil {
		stats = tt.GetStatsWithCoverage(coverage)
	} else {
		stats = tt.GetStats()
	}

	data, err := json.MarshalIndent(stats, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal test quality report: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write test quality report: %w", err)
	}

	return nil
}

func (tt *TestTagTracker) Reset() {
	tt.mu.Lock()
	defer tt.mu.Unlock()
	tt.tags = make([]TestTag, 0)
}

func (tt *TestTagTracker) GetTags() []TestTag {
	tt.mu.RLock()
	defer tt.mu.RUnlock()

	result := make([]TestTag, len(tt.tags))
	copy(result, tt.tags)
	return result
}
