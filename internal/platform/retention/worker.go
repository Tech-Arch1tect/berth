package retention

import (
	"context"
	"time"

	"go.uber.org/zap"
)

type Task struct {
	Name string
	Run  func() error
}

type Worker struct {
	interval time.Duration
	tasks    []Task
	logger   *zap.Logger

	stop    chan struct{}
	stopped chan struct{}
}

func NewWorker(interval time.Duration, logger *zap.Logger, tasks ...Task) *Worker {
	return &Worker{interval: interval, tasks: tasks, logger: logger}
}

func (w *Worker) Start(context.Context) error {
	if w.interval <= 0 || len(w.tasks) == 0 {
		w.logger.Info("retention worker disabled",
			zap.Duration("interval", w.interval),
			zap.Int("tasks", len(w.tasks)),
		)
		return nil
	}

	w.stop = make(chan struct{})
	w.stopped = make(chan struct{})

	go w.loop()
	return nil
}

func (w *Worker) loop() {
	defer close(w.stopped)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.runAll()
		case <-w.stop:
			return
		}
	}
}

func (w *Worker) runAll() {
	for _, t := range w.tasks {
		if err := t.Run(); err != nil {
			w.logger.Error("retention task failed",
				zap.String("task", t.Name),
				zap.Error(err),
			)
		}
	}
}

func (w *Worker) Stop(context.Context) error {
	if w.stop == nil {
		return nil
	}
	close(w.stop)
	<-w.stopped
	return nil
}
