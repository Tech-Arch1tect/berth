package authz

import "testing"

func TestKindValuesAreDistinct(t *testing.T) {
	kinds := []Kind{KindAuthenticated, KindServerAccess, KindServer, KindStack, KindAdmin}
	seen := map[Kind]bool{}
	for _, k := range kinds {
		if seen[k] {
			t.Fatalf("duplicate Kind value %d", k)
		}
		seen[k] = true
	}
}

func TestSystemPrincipalIsSystem(t *testing.T) {
	if !SystemPrincipal.IsSystem() {
		t.Fatal("SystemPrincipal.IsSystem() = false, want true")
	}
	if (Principal{}).IsSystem() {
		t.Fatal("zero Principal reported as system")
	}
}
