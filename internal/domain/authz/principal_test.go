package authz

import "testing"

func TestSystemPrincipalIsSystem(t *testing.T) {
	if !SystemPrincipal.IsSystem() {
		t.Fatal("SystemPrincipal.IsSystem() = false, want true")
	}
	if (Principal{}).IsSystem() {
		t.Fatal("zero Principal reported as system")
	}
	if !SystemPrincipal.IsAuthenticated() {
		t.Fatal("SystemPrincipal must count as authenticated")
	}
	if (Principal{}).IsAuthenticated() {
		t.Fatal("zero Principal must not count as authenticated")
	}
}

func TestPrincipalAccessors(t *testing.T) {
	sid := uint(3)
	key := &KeyDescriptor{ID: 9, Scopes: []KeyScope{{ServerID: &sid, StackPattern: "*", Permission: "stacks.read"}}}
	p := NewPrincipal(7, true, key)
	if p.UserID() != 7 || !p.IsAdmin() || p.Key() == nil || p.Key().ID != 9 {
		t.Fatalf("accessors disagree with construction: %+v", p)
	}
	if !p.IsAuthenticated() {
		t.Fatal("constructed principal must be authenticated")
	}
}
