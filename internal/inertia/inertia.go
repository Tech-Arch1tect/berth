package inertia

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"berth/internal/config"

	"github.com/labstack/echo/v4"
	gonertia "github.com/romsar/gonertia/v3"
	"go.uber.org/zap"
)

type Service struct {
	config   *config.InertiaConfig
	inertia  *gonertia.Inertia
	manifest ViteManifest
	logger   *zap.Logger
}

type ViteManifest map[string]ViteManifestEntry

type ViteManifestEntry struct {
	File    string   `json:"file"`
	Src     string   `json:"src"`
	IsEntry bool     `json:"isEntry"`
	CSS     []string `json:"css,omitempty"`
	Assets  []string `json:"assets,omitempty"`
}

func New(cfg *config.InertiaConfig, logger *zap.Logger) *Service {
	return &Service{config: cfg, logger: logger}
}

func (s *Service) InitializeFromFile(rootViewPath string) error {
	inst, err := gonertia.NewFromFile(rootViewPath, gonertia.WithFlashProvider(newscsFlashProvider()))
	if err != nil {
		return fmt.Errorf("inertia init from %q: %w", rootViewPath, err)
	}
	s.inertia = inst
	return nil
}

func (s *Service) ShareAssetData() {
	css, js, isDev := s.getAssets()
	s.inertia.ShareTemplateData("cssAssets", css)
	s.inertia.ShareTemplateData("jsAssets", js)
	s.inertia.ShareTemplateData("isDevelopment", isDev)
	s.inertia.ShareTemplateData("viteDevURL", s.config.ViteDevURL)
}

func (s *Service) Middleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			handler := s.inertia.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				c.SetRequest(r)
				if err := next(c); err != nil {
					c.Error(err)
				}
			}))
			handler.ServeHTTP(c.Response(), c.Request())
			return nil
		}
	}
}

func (s *Service) Render(c echo.Context, component string, props gonertia.Props) error {
	if s.inertia == nil {
		return fmt.Errorf("inertia instance is nil")
	}
	if err := s.inertia.Render(c.Response(), c.Request(), component, props); err != nil {
		s.logger.Error("inertia render failed", zap.Error(err), zap.String("component", component))
		return err
	}
	return nil
}

func (s *Service) Redirect(c echo.Context, url string) error {
	method := c.Request().Method
	if method == "PUT" || method == "PATCH" || method == "DELETE" {
		c.Response().Header().Set("Location", url)
		c.Response().WriteHeader(http.StatusSeeOther)
		return nil
	}
	s.inertia.Redirect(c.Response(), c.Request(), url)
	return nil
}

func (s *Service) LoadManifest(manifestPath string) error {
	if s.config.Development {
		return nil
	}
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("read vite manifest %q: %w", manifestPath, err)
	}
	var m ViteManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("parse vite manifest: %w", err)
	}
	s.manifest = m
	return nil
}

func (s *Service) getAssets() (css, js []string, isDevelopment bool) {
	if s.config.Development {
		return nil, nil, true
	}
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
	return css, js, false
}
