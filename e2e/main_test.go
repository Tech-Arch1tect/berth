package e2e

import (
	"fmt"
	"os"
	"testing"

	e2etesting "github.com/tech-arch1tect/brx/testing"
)

// TestMain runs before/after all tests in this package
//
// Coverage reports are written to files by default:
//   - coverage-report.txt - human readable report
//   - coverage-report.json - machine readable report
//
// Environment variables:
//   - E2E_COVERAGE=false - disable coverage tracking entirely
//   - E2E_COVERAGE_JSON=path - custom path for JSON report
//   - E2E_COVERAGE_FILE=path - custom path for text report
func TestMain(m *testing.M) {

	code := m.Run()

	if os.Getenv("E2E_COVERAGE") == "false" {
		os.Exit(code)
	}

	stats := GetCoverageStats()
	if stats.TotalRoutes > 0 {
		tracker := GetGlobalCoverageTracker()

		jsonFile := os.Getenv("E2E_COVERAGE_JSON")
		if jsonFile == "" {
			jsonFile = "coverage-report.json"
		}
		if err := tracker.WriteJSONReport(jsonFile); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write JSON coverage report: %v\n", err)
		}

		textFile := os.Getenv("E2E_COVERAGE_FILE")
		if textFile == "" {
			textFile = "coverage-report.txt"
		}
		if err := tracker.WriteReportToFile(textFile); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write coverage report file: %v\n", err)
		}

		fmt.Printf("\nAPI Coverage: %d/%d endpoints (%.1f%%) - see %s for details\n",
			stats.CoveredRoutes, stats.TotalRoutes, stats.Coverage, textFile)
	}

	qualityStats := GetTestQualityStats()
	if qualityStats.TotalTests > 0 {
		qualityTracker := e2etesting.GetTestTagTracker()
		coverageTracker := GetGlobalCoverageTracker()

		qualityJSONFile := os.Getenv("E2E_QUALITY_JSON")
		if qualityJSONFile == "" {
			qualityJSONFile = "quality-report.json"
		}
		if err := qualityTracker.WriteJSONReportWithCoverage(qualityJSONFile, coverageTracker); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write JSON quality report: %v\n", err)
		}

		qualityTextFile := os.Getenv("E2E_QUALITY_FILE")
		if qualityTextFile == "" {
			qualityTextFile = "quality-report.txt"
		}
		if err := qualityTracker.WriteReportToFileWithCoverage(qualityTextFile, coverageTracker); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write quality report file: %v\n", err)
		}

		fmt.Printf("Test Quality: %d tagged tests, avg score: %.1f - see %s for details\n",
			qualityStats.TotalTests, qualityStats.AverageScore, qualityTextFile)
	}

	os.Exit(code)
}
