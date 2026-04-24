package compose

import (
	"sort"
	"testing"
)

func TestExtractRegistryFromImage(t *testing.T) {
	tests := []struct {
		image string
		want  string
	}{
		{"nginx", "docker.io"},
		{"nginx:latest", "docker.io"},
		{"library/nginx", "docker.io"},
		{"myuser/myimage", "docker.io"},
		{"myuser/myimage:v1", "docker.io"},

		{"ghcr.io/owner/image", "ghcr.io"},
		{"ghcr.io/owner/image:latest", "ghcr.io"},
		{"registry.example.com/myimage", "registry.example.com"},
		{"registry.example.com/org/image:v2", "registry.example.com"},

		{"localhost:5000/myimage", "localhost:5000"},
		{"myregistry.local:5000/org/image:latest", "myregistry.local:5000"},

		{"nginx@sha256:abc123", "docker.io"},
		{"ghcr.io/owner/image@sha256:abc123", "ghcr.io"},

		{"ghcr.io/owner/image:v1@sha256:abc123", "ghcr.io"},
	}

	for _, tt := range tests {
		got := ExtractRegistryFromImage(tt.image)
		if got != tt.want {
			t.Errorf("ExtractRegistryFromImage(%q) = %q, want %q", tt.image, got, tt.want)
		}
	}
}

func TestExtractRegistries(t *testing.T) {
	t.Run("multi-service compose", func(t *testing.T) {
		content := `services:
  web:
    image: nginx:latest
  api:
    image: ghcr.io/myorg/api:v1
  db:
    image: postgres:15
`
		registries, err := ExtractRegistries(content)
		if err != nil {
			t.Fatalf("ExtractRegistries failed: %v", err)
		}

		sort.Strings(registries)
		want := []string{"docker.io", "ghcr.io"}
		if len(registries) != len(want) {
			t.Fatalf("got %v, want %v", registries, want)
		}
		for i, r := range registries {
			if r != want[i] {
				t.Errorf("registries[%d] = %q, want %q", i, r, want[i])
			}
		}
	})

	t.Run("dedup", func(t *testing.T) {
		content := `services:
  web1:
    image: nginx
  web2:
    image: nginx:alpine
`
		registries, err := ExtractRegistries(content)
		if err != nil {
			t.Fatalf("ExtractRegistries failed: %v", err)
		}
		if len(registries) != 1 || registries[0] != "docker.io" {
			t.Errorf("got %v, want [docker.io]", registries)
		}
	})

	t.Run("service without image", func(t *testing.T) {
		content := `services:
  app:
    build: .
  web:
    image: nginx
`
		registries, err := ExtractRegistries(content)
		if err != nil {
			t.Fatalf("ExtractRegistries failed: %v", err)
		}
		if len(registries) != 1 || registries[0] != "docker.io" {
			t.Errorf("got %v, want [docker.io]", registries)
		}
	})

	t.Run("invalid YAML", func(t *testing.T) {
		_, err := ExtractRegistries("not: valid: yaml: [[[")
		if err == nil {
			t.Error("expected error for invalid YAML")
		}
	})
}

func TestNormalizeRegistryURL(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"https://ghcr.io", "ghcr.io"},
		{"http://ghcr.io", "ghcr.io"},
		{"https://ghcr.io/", "ghcr.io"},
		{"GHCR.IO", "ghcr.io"},
		{"https://Registry.Example.COM/", "registry.example.com"},
		{"docker.io", "docker.io"},
		{"localhost:5000", "localhost:5000"},
		{"http://localhost:5000/", "localhost:5000"},
		{"", ""},
	}

	for _, tt := range tests {
		got := NormalizeRegistryURL(tt.input)
		if got != tt.want {
			t.Errorf("NormalizeRegistryURL(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
