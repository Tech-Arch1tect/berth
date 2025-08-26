package utils

import (
	"strings"
)

func MatchesPattern(text, pattern string) bool {
	if pattern == "*" {
		return true
	}

	text = strings.ToLower(text)
	pattern = strings.ToLower(pattern)

	return matchesComplexPattern(text, pattern)
}

func matchesComplexPattern(text, pattern string) bool {
	if !strings.Contains(pattern, "*") {
		return text == pattern
	}

	parts := strings.Split(pattern, "*")

	if len(parts) == 1 {
		return text == pattern
	}

	textPos := 0

	for i, part := range parts {
		if part == "" {
			continue
		}

		if i == 0 {
			if !strings.HasPrefix(text, part) {
				return false
			}
			textPos = len(part)
		} else if i == len(parts)-1 {
			if !strings.HasSuffix(text, part) {
				return false
			}
			if len(text) < textPos+len(part) {
				return false
			}
		} else {
			index := strings.Index(text[textPos:], part)
			if index == -1 {
				return false
			}
			textPos += index + len(part)
		}
	}

	return true
}
