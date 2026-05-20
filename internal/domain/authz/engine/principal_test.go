package engine

import "testing"

func TestSystemPrincipalIsSystem(t *testing.T) {
	if !SystemPrincipal.IsSystem() {
		t.Fatal("SystemPrincipal.IsSystem() = false, want true")
	}
	if (Principal{}).IsSystem() {
		t.Fatal("zero Principal reported as system")
	}
}
