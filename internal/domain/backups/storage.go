package backups

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sort"
	"sync"

	"berth/internal/domain/server"
)

type storageTopology struct {
	sync.RWMutex
}

type storageLockTable struct {
	mu    sync.Mutex
	locks map[uint]*sync.RWMutex
}

func newStorageLockTable() *storageLockTable {
	return &storageLockTable{locks: make(map[uint]*sync.RWMutex)}
}

func (t *storageLockTable) get(serverID uint) *sync.RWMutex {
	t.mu.Lock()
	defer t.mu.Unlock()
	lock, ok := t.locks[serverID]
	if !ok {
		lock = &sync.RWMutex{}
		t.locks[serverID] = lock
	}
	return lock
}

func (s *Service) ReserveBackupStorageTopologyRead() (func(), error) {
	if !s.storageTopology.TryRLock() {
		return nil, server.ErrBackupStorageBusy
	}
	return s.storageTopology.RUnlock, nil
}

func (s *Service) ReserveBackupStorageTopologyWrite() (func(), error) {
	if !s.storageTopology.TryLock() {
		return nil, server.ErrBackupStorageBusy
	}
	return s.storageTopology.Unlock, nil
}

func (s *Service) ReserveBackupStorageRead(serverID uint) (func(), error) {
	if s.storageLocks == nil {
		return nil, server.ErrBackupStorageUnavailable
	}
	lock := s.storageLocks.get(serverID)
	if !lock.TryRLock() {
		return nil, ErrRepositoryBusy
	}
	return lock.RUnlock, nil
}

func (s *Service) ReserveBackupStorageWrite(serverID uint) (func(), error) {
	if s.storageLocks == nil {
		return nil, server.ErrBackupStorageUnavailable
	}
	lock := s.storageLocks.get(serverID)
	if !lock.TryLock() {
		return nil, server.ErrBackupStorageBusy
	}
	return lock.Unlock, nil
}

func (s *Service) ReserveBackupStorageWrites(serverIDs []uint) (func(), error) {
	ids := append([]uint(nil), serverIDs...)
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	releases := make([]func(), 0, len(ids))
	var previous uint
	for index, serverID := range ids {
		if index > 0 && serverID == previous {
			continue
		}
		previous = serverID
		release, err := s.ReserveBackupStorageWrite(serverID)
		if err != nil {
			for i := len(releases) - 1; i >= 0; i-- {
				releases[i]()
			}
			return nil, err
		}
		releases = append(releases, release)
	}
	return func() {
		for i := len(releases) - 1; i >= 0; i-- {
			releases[i]()
		}
	}, nil
}

func (s *Service) RequireEmptyBackupStorage(ctx context.Context, serverID uint) error {
	state, err := s.BackupStorageStatus(ctx, serverID)
	if err != nil {
		switch {
		case errors.Is(err, ErrRepositoryBusy):
			return server.ErrBackupStorageBusy
		case errors.Is(err, ErrBackupStorageUnavailable), errors.Is(err, ErrServerNotFound):
			return server.ErrBackupStorageUnavailable
		default:
			return fmt.Errorf("failed to read backup storage status: %w", err)
		}
	}
	if !state.Empty {
		return fmt.Errorf("%w: %d backup records across %d stacks remain", server.ErrBackupStorageHasHistory, state.RecordCount, state.StackCount)
	}
	return nil
}

type storageReadCloser struct {
	io.ReadCloser
	release func()
	once    sync.Once
}

func (r *storageReadCloser) Read(data []byte) (int, error) {
	read, err := r.ReadCloser.Read(data)
	if err != nil {
		r.once.Do(r.release)
	}
	return read, err
}

func (r *storageReadCloser) Close() error {
	err := r.ReadCloser.Close()
	r.once.Do(r.release)
	return err
}
