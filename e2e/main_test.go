package e2e

import (
	"fmt"
	"os"
	"testing"
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

	os.Exit(code)
}
