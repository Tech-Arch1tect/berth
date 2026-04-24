package main

import (
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"
)

func TestInternalLayering(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	repoRoot := filepath.Dir(thisFile)
	internalDir := filepath.Join(repoRoot, "internal")

	bannedPrefixes := map[string][]string{
		"pkg":      {"berth/internal/platform/", "berth/internal/domain/", "berth/internal/app", "berth/models"},
		"platform": {"berth/internal/domain/", "berth/internal/app"},
		"domain":   {"berth/internal/app"},
	}

	var failures []string
	root := os.DirFS(internalDir)
	if err := fs.WalkDir(root, ".", func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		parts := strings.SplitN(path, string(filepath.Separator), 2)
		if len(parts) < 2 {
			return nil
		}
		tier := parts[0]
		banned, ok := bannedPrefixes[tier]
		if !ok {
			return nil
		}

		fset := token.NewFileSet()
		full := filepath.Join(internalDir, path)
		f, err := parser.ParseFile(fset, full, nil, parser.ImportsOnly)
		if err != nil {
			return nil
		}
		for _, imp := range f.Imports {
			ipath := strings.Trim(imp.Path.Value, "\"")
			for _, b := range banned {
				if strings.HasPrefix(ipath, b) {
					failures = append(failures, "internal/"+path+" ("+tier+" tier) imports "+ipath)
				}
			}
		}
		return nil
	}); err != nil {
		t.Fatalf("walk failed: %v", err)
	}

	sort.Strings(failures)
	for _, f := range failures {
		t.Error(f)
	}
}
