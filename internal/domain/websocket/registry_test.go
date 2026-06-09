package websocket

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func receiveEvent(t *testing.T, sub *EventSubscription) any {
	t.Helper()
	select {
	case ev := <-sub.Events():
		return ev
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event")
		return nil
	}
}

func assertNoEvent(t *testing.T, sub *EventSubscription) {
	t.Helper()
	select {
	case ev := <-sub.Events():
		t.Fatalf("expected no event, got %#v", ev)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestStackEventRegistryDeliversOnlyToMatchingStack(t *testing.T) {
	r := NewStackEventRegistry(zap.NewNop())

	subAlpha, cancelAlpha := r.Subscribe(StackKey{ServerID: 1, StackName: "alpha"})
	defer cancelAlpha()
	subBeta, cancelBeta := r.Subscribe(StackKey{ServerID: 1, StackName: "beta"})
	defer cancelBeta()
	subOtherServer, cancelOther := r.Subscribe(StackKey{ServerID: 2, StackName: "alpha"})
	defer cancelOther()

	event := StackStatusEvent{
		BaseMessage: BaseMessage{Type: MessageTypeStackStatus, Timestamp: "2026-06-09T00:00:00Z"},
		ServerID:    1,
		StackName:   "alpha",
		Status:      "running",
		Services:    3,
		Running:     3,
	}
	r.PublishStackStatus(event)

	got := receiveEvent(t, subAlpha)
	require.IsType(t, StackStatusEvent{}, got)
	assert.Equal(t, event, got.(StackStatusEvent))

	assertNoEvent(t, subBeta)
	assertNoEvent(t, subOtherServer)
}

func TestStackEventRegistryDeliversContainerStatus(t *testing.T) {
	r := NewStackEventRegistry(zap.NewNop())

	sub, cancel := r.Subscribe(StackKey{ServerID: 7, StackName: "web"})
	defer cancel()

	event := ContainerStatusEvent{
		BaseMessage:   BaseMessage{Type: MessageTypeContainerStatus, Timestamp: "2026-06-09T00:00:00Z"},
		ServerID:      7,
		StackName:     "web",
		ServiceName:   "app",
		ContainerName: "web-app-1",
		ContainerID:   "abc123",
		Status:        "running",
		Image:         "nginx:latest",
	}
	r.PublishContainerStatus(event)

	got := receiveEvent(t, sub)
	require.IsType(t, ContainerStatusEvent{}, got)
	assert.Equal(t, event, got.(ContainerStatusEvent))
}

func TestStackEventRegistryCancelStopsDelivery(t *testing.T) {
	r := NewStackEventRegistry(zap.NewNop())

	sub, cancel := r.Subscribe(StackKey{ServerID: 1, StackName: "alpha"})
	cancel()

	select {
	case <-sub.Done():
	default:
		t.Fatal("cancel must stop the subscription")
	}

	r.PublishStackStatus(StackStatusEvent{ServerID: 1, StackName: "alpha"})
	assertNoEvent(t, sub)
}

func TestStackEventRegistryStopsSlowSubscriber(t *testing.T) {
	r := NewStackEventRegistry(zap.NewNop())

	sub, cancel := r.Subscribe(StackKey{ServerID: 1, StackName: "alpha"})
	defer cancel()

	for range subscriptionBuffer + 1 {
		r.PublishStackStatus(StackStatusEvent{ServerID: 1, StackName: "alpha"})
	}

	select {
	case <-sub.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("subscriber that stopped draining must be stopped")
	}
}

func TestStackEventRegistryDropsEventsWithoutStackName(t *testing.T) {
	r := NewStackEventRegistry(zap.NewNop())

	sub, cancel := r.Subscribe(StackKey{ServerID: 1, StackName: ""})
	defer cancel()

	r.PublishStackStatus(StackStatusEvent{ServerID: 1, StackName: ""})
	r.PublishContainerStatus(ContainerStatusEvent{ServerID: 1, StackName: ""})
	assertNoEvent(t, sub)
}
