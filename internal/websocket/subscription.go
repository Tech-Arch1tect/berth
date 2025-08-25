package websocket

import (
	"fmt"
	"sync"
)

type SubscriptionKey string

type SubscriptionManager struct {
	subscriptions map[SubscriptionKey]map[*UserConnection]bool
	mutex         sync.RWMutex
}

func NewSubscriptionManager() *SubscriptionManager {
	return &SubscriptionManager{
		subscriptions: make(map[SubscriptionKey]map[*UserConnection]bool),
	}
}

func (sm *SubscriptionManager) Subscribe(conn *UserConnection, resource string, serverID int, stackName string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	key := sm.createKey(resource, serverID, stackName)

	if sm.subscriptions[key] == nil {
		sm.subscriptions[key] = make(map[*UserConnection]bool)
	}

	sm.subscriptions[key][conn] = true
	conn.subscriptions[key] = true
}

func (sm *SubscriptionManager) Unsubscribe(conn *UserConnection, resource string, serverID int, stackName string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	key := sm.createKey(resource, serverID, stackName)

	if sm.subscriptions[key] != nil {
		delete(sm.subscriptions[key], conn)

		if len(sm.subscriptions[key]) == 0 {
			delete(sm.subscriptions, key)
		}
	}

	delete(conn.subscriptions, key)
}

func (sm *SubscriptionManager) UnsubscribeAll(conn *UserConnection) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()

	for key := range conn.subscriptions {
		if sm.subscriptions[key] != nil {
			delete(sm.subscriptions[key], conn)

			if len(sm.subscriptions[key]) == 0 {
				delete(sm.subscriptions, key)
			}
		}
	}

	conn.subscriptions = make(map[SubscriptionKey]bool)
}

func (sm *SubscriptionManager) GetSubscribers(resource string, serverID int, stackName string) []*UserConnection {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()

	key := sm.createKey(resource, serverID, stackName)

	var subscribers []*UserConnection
	if sm.subscriptions[key] != nil {
		for conn := range sm.subscriptions[key] {
			subscribers = append(subscribers, conn)
		}
	}

	return subscribers
}

func (sm *SubscriptionManager) createKey(resource string, serverID int, stackName string) SubscriptionKey {
	if stackName != "" {
		return SubscriptionKey(fmt.Sprintf("%s:%d:%s", resource, serverID, stackName))
	}
	return SubscriptionKey(fmt.Sprintf("%s:%d", resource, serverID))
}
