package authz

import "testing"

func TestKindValuesAreDistinct(t *testing.T) {
	kinds := []Kind{KindAuthenticated, KindServerAccess, KindServer, KindStack, KindAdmin, KindAPIKeyScope}
	seen := map[Kind]bool{}
	for _, k := range kinds {
		if seen[k] {
			t.Fatalf("duplicate Kind value %d", k)
		}
		seen[k] = true
	}
}
