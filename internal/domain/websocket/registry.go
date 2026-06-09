package websocket

import (
	"sync"

	"go.uber.org/zap"
)

type StackKey struct {
	ServerID  uint
	StackName string
}

type StackEventRegistry struct {
	mu     sync.RWMutex
	conns  map[StackKey]map[*EventSubscription]struct{}
	logger *zap.Logger
}

func NewStackEventRegistry(logger *zap.Logger) *StackEventRegistry {
	return &StackEventRegistry{
		conns:  make(map[StackKey]map[*EventSubscription]struct{}),
		logger: logger,
	}
}

type EventSubscription struct {
	events chan any
	done   chan struct{}
	once   sync.Once
}

func (s *EventSubscription) Events() <-chan any { return s.events }

func (s *EventSubscription) Done() <-chan struct{} { return s.done }

func (s *EventSubscription) Stop() {
	s.once.Do(func() { close(s.done) })
}

const subscriptionBuffer = 64

func (r *StackEventRegistry) Subscribe(key StackKey) (*EventSubscription, func()) {
	sub := &EventSubscription{
		events: make(chan any, subscriptionBuffer),
		done:   make(chan struct{}),
	}

	r.mu.Lock()
	set, ok := r.conns[key]
	if !ok {
		set = make(map[*EventSubscription]struct{})
		r.conns[key] = set
	}
	set[sub] = struct{}{}
	r.mu.Unlock()

	cancel := func() {
		sub.Stop()
		r.mu.Lock()
		if set, ok := r.conns[key]; ok {
			delete(set, sub)
			if len(set) == 0 {
				delete(r.conns, key)
			}
		}
		r.mu.Unlock()
	}
	return sub, cancel
}

func (r *StackEventRegistry) PublishContainerStatus(event ContainerStatusEvent) {
	if event.ServerID < 0 || event.StackName == "" {
		r.logger.Debug("dropping container status event without a stack key",
			zap.Int("server_id", event.ServerID),
			zap.String("stack_name", event.StackName),
		)
		return
	}
	r.publish(StackKey{ServerID: uint(event.ServerID), StackName: event.StackName}, event)
}

func (r *StackEventRegistry) PublishStackStatus(event StackStatusEvent) {
	if event.ServerID < 0 || event.StackName == "" {
		r.logger.Debug("dropping stack status event without a stack key",
			zap.Int("server_id", event.ServerID),
			zap.String("stack_name", event.StackName),
		)
		return
	}
	r.publish(StackKey{ServerID: uint(event.ServerID), StackName: event.StackName}, event)
}

func (r *StackEventRegistry) publish(key StackKey, event any) {
	r.mu.RLock()
	subs := make([]*EventSubscription, 0, len(r.conns[key]))
	for sub := range r.conns[key] {
		subs = append(subs, sub)
	}
	r.mu.RUnlock()

	for _, sub := range subs {
		select {
		case <-sub.done:
		case sub.events <- event:
		default:
			r.logger.Warn("stopping slow stack events subscriber",
				zap.Uint("server_id", key.ServerID),
				zap.String("stack_name", key.StackName),
			)
			sub.Stop()
		}
	}
}
