package utils

import (
	"strings"

	"gopkg.in/yaml.v3"
)

type ComposeFile struct {
	Services map[string]Service `yaml:"services"`
}

type Service struct {
	Image string `yaml:"image"`
}

func ExtractRegistries(composeContent string) ([]string, error) {
	var compose ComposeFile
	if err := yaml.Unmarshal([]byte(composeContent), &compose); err != nil {
		return nil, err
	}

	registrySet := make(map[string]bool)

	for _, service := range compose.Services {
		if service.Image == "" {
			continue
		}

		registry := ExtractRegistryFromImage(service.Image)
		if registry != "" {
			registrySet[registry] = true
		}
	}

	registries := make([]string, 0, len(registrySet))
	for registry := range registrySet {
		registries = append(registries, registry)
	}

	return registries, nil
}

func ExtractRegistryFromImage(imageRef string) string {
	imageParts := strings.Split(imageRef, "@")
	imageWithoutDigest := imageParts[0]

	parts := strings.Split(imageWithoutDigest, ":")
	imageWithoutTag := parts[0]

	slashParts := strings.Split(imageWithoutTag, "/")

	if len(slashParts) == 1 {
		return "docker.io"
	}

	if len(slashParts) == 2 {
		if strings.Contains(slashParts[0], ".") || strings.Contains(slashParts[0], ":") {
			return slashParts[0]
		}
		return "docker.io"
	}

	return slashParts[0]
}

func NormalizeRegistryURL(registryURL string) string {
	registryURL = strings.TrimPrefix(registryURL, "https://")
	registryURL = strings.TrimPrefix(registryURL, "http://")

	registryURL = strings.TrimSuffix(registryURL, "/")

	return strings.ToLower(registryURL)
}
