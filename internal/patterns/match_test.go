package patterns

import "testing"

func TestMatches(t *testing.T) {
	tests := []struct {
		text    string
		pattern string
		want    bool
	}{
		{"mystack", "mystack", true},
		{"mystack", "other", false},

		{"anything", "*", true},
		{"", "*", true},

		{"prod-web", "prod-*", true},
		{"staging-web", "prod-*", false},

		{"my-stack", "*-stack", true},
		{"my-service", "*-stack", false},

		{"prod-web-stack", "prod-*-stack", true},
		{"prod-stack", "prod-*-stack", false},
		{"dev-web-stack", "prod-*-stack", false},

		{"prod-web-us-east", "prod-*-us-*", true},
		{"dev-web-us-east", "prod-*-us-*", false},

		{"MyStack", "mystack", true},
		{"MYSTACK", "mystack", true},
		{"mystack", "MYSTACK", true},
		{"Prod-Web", "prod-*", true},

		{"", "", true},
		{"", "notempty", false},
		{"notempty", "", false},

		{"abc", "abcd", false},
		{"abcd", "abc", false},
	}

	for _, tt := range tests {
		got := Matches(tt.text, tt.pattern)
		if got != tt.want {
			t.Errorf("Matches(%q, %q) = %v, want %v", tt.text, tt.pattern, got, tt.want)
		}
	}
}
