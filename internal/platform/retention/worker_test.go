package retention

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestRunAll_RunsEveryTaskAndIsolatesErrors(t *testing.T) {
	var first, third int32
	tasks := []Task{
		{Name: "first", Run: func() error { atomic.AddInt32(&first, 1); return nil }},
		{Name: "second-fails", Run: func() error { return errors.New("boom") }},
		{Name: "third", Run: func() error { atomic.AddInt32(&third, 1); return nil }},
	}

	w := NewWorker(time.Hour, zap.NewNop(), tasks...)
	w.runAll()

	assert.Equal(t, int32(1), first, "first task must run")
	assert.Equal(t, int32(1), third, "a failing earlier task must not stop later tasks")
}

func TestStart_DisabledWhenIntervalNonPositive(t *testing.T) {
	var ran int32
	w := NewWorker(0, zap.NewNop(), Task{Name: "x", Run: func() error { atomic.AddInt32(&ran, 1); return nil }})

	require.NoError(t, w.Start(t.Context()))
	require.NoError(t, w.Stop(t.Context()), "Stop must be safe when Start was a no-op")
	assert.Equal(t, int32(0), ran, "no task should run when the worker is disabled")
}

func TestStart_DisabledWhenNoTasks(t *testing.T) {
	w := NewWorker(time.Hour, zap.NewNop())
	require.NoError(t, w.Start(t.Context()))
	require.NoError(t, w.Stop(t.Context()))
}

func TestStartStop_RunsTasksOnTickThenStopsCleanly(t *testing.T) {
	var ran int32
	var wg sync.WaitGroup
	wg.Add(1)
	var once sync.Once

	w := NewWorker(5*time.Millisecond, zap.NewNop(), Task{
		Name: "tick",
		Run: func() error {
			atomic.AddInt32(&ran, 1)
			once.Do(wg.Done)
			return nil
		},
	})

	require.NoError(t, w.Start(t.Context()))
	wg.Wait()
	require.NoError(t, w.Stop(t.Context()))

	after := atomic.LoadInt32(&ran)
	assert.GreaterOrEqual(t, after, int32(1), "task must run on the tick")

	time.Sleep(20 * time.Millisecond)
	assert.Equal(t, after, atomic.LoadInt32(&ran), "no task may run after Stop")
}
