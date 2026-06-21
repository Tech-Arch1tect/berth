package security

import "testing"

func TestRegistryEventsAreClassifiedNotUnknown(t *testing.T) {
	events := []string{
		EventRegistryCredentialCreated,
		EventRegistryCredentialUpdated,
		EventRegistryCredentialDeleted,
	}
	for _, e := range events {
		if got := GetEventCategory(e); got != CategoryRegistry {
			t.Errorf("GetEventCategory(%q) = %q, want %q", e, got, CategoryRegistry)
		}
		if got := GetEventSeverity(e); got != SeverityMedium {
			t.Errorf("GetEventSeverity(%q) = %q, want %q", e, got, SeverityMedium)
		}
	}
}
