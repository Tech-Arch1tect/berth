package app_test

import (
	"flag"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"

	"berth/internal/app/apptest"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

var updateRouteSnapshot = flag.Bool("update-routes", false, "rewrite the route snapshot from the live app")

func testdataDir(t *testing.T) string {
	t.Helper()
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(thisFile), "testdata")
}

func TestRouteSnapshot(t *testing.T) {
	booted := apptest.Boot(t)

	got := dumpRoutes(booted.Echo.Routes())

	goldenPath := filepath.Join(testdataDir(t), "routes.golden.txt")

	if *updateRouteSnapshot {
		require.NoError(t, os.MkdirAll(filepath.Dir(goldenPath), 0o755))
		require.NoError(t, os.WriteFile(goldenPath, []byte(got), 0o644))
		t.Logf("wrote %s", goldenPath)
		return
	}

	wantBytes, err := os.ReadFile(goldenPath)
	require.NoError(t, err, "missing %s — run `go test -update-routes` to create it", goldenPath)

	if got != string(wantBytes) {
		t.Errorf("route snapshot drift — re-run with -update-routes if intentional\n--- lines only in want / only in got ---\n%s",
			lineDiff(string(wantBytes), got))
	}
}

func dumpRoutes(routes []*echo.Route) string {
	type entry struct {
		method  string
		path    string
		handler string
	}

	skip := map[string]bool{
		"github.com/labstack/echo/v4.init.func1": true,
	}

	rows := make([]entry, 0, len(routes))
	for _, r := range routes {
		if skip[r.Name] {
			continue
		}
		rows = append(rows, entry{
			method:  r.Method,
			path:    r.Path,
			handler: shortenHandler(r.Name),
		})
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].path != rows[j].path {
			return rows[i].path < rows[j].path
		}
		return rows[i].method < rows[j].method
	})

	var b strings.Builder
	for _, r := range rows {
		b.WriteString(r.method)
		b.WriteByte('\t')
		b.WriteString(r.path)
		b.WriteByte('\t')
		b.WriteString(r.handler)
		b.WriteByte('\n')
	}
	return b.String()
}

func shortenHandler(name string) string {
	const modulePrefix = "berth/"
	if idx := strings.Index(name, modulePrefix); idx >= 0 {
		return name[idx+len(modulePrefix):]
	}
	return name
}

func lineDiff(want, got string) string {
	wantLines := strings.Split(want, "\n")
	gotLines := strings.Split(got, "\n")

	wantSet := make(map[string]struct{}, len(wantLines))
	for _, l := range wantLines {
		wantSet[l] = struct{}{}
	}
	gotSet := make(map[string]struct{}, len(gotLines))
	for _, l := range gotLines {
		gotSet[l] = struct{}{}
	}

	var b strings.Builder
	for _, l := range wantLines {
		if _, ok := gotSet[l]; !ok && l != "" {
			b.WriteString("- ")
			b.WriteString(l)
			b.WriteByte('\n')
		}
	}
	for _, l := range gotLines {
		if _, ok := wantSet[l]; !ok && l != "" {
			b.WriteString("+ ")
			b.WriteString(l)
			b.WriteByte('\n')
		}
	}
	return b.String()
}
