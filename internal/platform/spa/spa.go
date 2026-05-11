package spa

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

const ManifestPath = "public/build/.vite/manifest.json"

type ViteManifest map[string]ViteManifestEntry

type ViteManifestEntry struct {
	File    string   `json:"file"`
	Src     string   `json:"src"`
	IsEntry bool     `json:"isEntry"`
	CSS     []string `json:"css,omitempty"`
}

type Service struct {
	tmpl        *template.Template
	manifest    ViteManifest
	development bool
	viteDevURL  string
	logger      *zap.Logger
}

func New(development bool, viteDevURL string, logger *zap.Logger) *Service {
	return &Service{
		development: development,
		viteDevURL:  viteDevURL,
		logger:      logger,
	}
}

func (s *Service) LoadTemplate(path string) error {
	t, err := template.ParseFiles(path)
	if err != nil {
		return fmt.Errorf("parse SPA template %q: %w", path, err)
	}
	s.tmpl = t
	return nil
}

func (s *Service) LoadManifest(path string) error {
	if s.development {
		return nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read vite manifest %q: %w", path, err)
	}
	var m ViteManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("parse vite manifest: %w", err)
	}
	s.manifest = m
	return nil
}

func (s *Service) Render(c echo.Context) error {
	path := c.Request().URL.Path
	if strings.HasPrefix(path, "/api/") ||
		strings.HasPrefix(path, "/build/") ||
		strings.HasPrefix(path, "/ws/") ||
		strings.HasPrefix(path, "/openapi.") ||
		path == "/docs" {
		return echo.NewHTTPError(http.StatusNotFound, "Not Found")
	}

	accept := c.Request().Header.Get("Accept")
	if accept != "" && !strings.Contains(accept, "text/html") && !strings.Contains(accept, "*/*") {
		return echo.NewHTTPError(http.StatusNotFound, "Not Found")
	}

	if s.tmpl == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "SPA template not loaded")
	}

	css, js := s.getAssets()
	data := map[string]any{
		"isDevelopment": s.development,
		"viteDevURL":    s.viteDevURL,
		"cssAssets":     css,
		"jsAssets":      js,
	}

	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	c.Response().WriteHeader(http.StatusOK)
	return s.tmpl.Execute(c.Response().Writer, data)
}

func (s *Service) getAssets() (css, js []string) {
	for _, entry := range s.manifest {
		if !entry.IsEntry {
			continue
		}
		for _, c := range entry.CSS {
			css = append(css, "/build/"+c)
		}
		if entry.File != "" {
			js = append(js, "/build/"+entry.File)
		}
	}
	return css, js
}
