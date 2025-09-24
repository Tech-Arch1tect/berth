package queue

import (
	"berth/internal/operations"
	"berth/models"
	"context"
	"sync"
	"time"

	"go.uber.org/zap"
)

func (w *StackWorker) process(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	defer func() {
		w.active = false
		close(w.queue)
	}()

	w.logger.Info("starting stack worker",
		zap.String("stack_key", w.stackKey),
	)

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("stack worker shutting down",
				zap.String("stack_key", w.stackKey),
			)
			return

		case queuedOp, ok := <-w.queue:
			if !ok {
				w.logger.Info("stack worker queue closed",
					zap.String("stack_key", w.stackKey),
				)
				return
			}

			w.processOperation(ctx, queuedOp)
		}
	}
}

func (w *StackWorker) processOperation(ctx context.Context, queuedOp *models.QueuedOperation) {
	w.logger.Info("processing queued operation",
		zap.String("stack_key", w.stackKey),
		zap.String("operation_id", queuedOp.OperationID),
		zap.String("command", queuedOp.Command),
	)

	if queuedOp.DependsOn != nil {
		if !w.waitForDependency(ctx, *queuedOp.DependsOn) {
			w.logger.Warn("dependency not satisfied, skipping operation",
				zap.String("operation_id", queuedOp.OperationID),
				zap.String("depends_on", *queuedOp.DependsOn),
			)
			w.markOperationStatus(queuedOp.OperationID, models.OperationStatusCancelled)
			return
		}
	}

	if !w.markOperationStatus(queuedOp.OperationID, models.OperationStatusRunning) {
		w.logger.Warn("failed to mark operation as running",
			zap.String("operation_id", queuedOp.OperationID),
		)
		return
	}

	startTime := time.Now()
	operationLog := &models.OperationLog{
		UserID:      queuedOp.UserID,
		ServerID:    queuedOp.ServerID,
		StackName:   queuedOp.StackName,
		OperationID: queuedOp.OperationID,
		BatchID:     queuedOp.BatchID,
		Command:     queuedOp.Command,
		Options:     queuedOp.Options,
		Services:    queuedOp.Services,
		Status:      models.OperationStatusRunning,
		Order:       queuedOp.Order,
		DependsOn:   queuedOp.DependsOn,
		WebhookID:   queuedOp.WebhookID,
		QueuedAt:    &queuedOp.QueuedAt,
		StartTime:   startTime,
	}

	err := w.service.db.Create(operationLog).Error
	if err != nil {
		w.logger.Error("failed to create operation log",
			zap.Error(err),
			zap.String("operation_id", queuedOp.OperationID),
		)
	}

	operationReq := operations.OperationRequest{
		Command:  queuedOp.Command,
		Options:  w.service.deserializeStringArray(queuedOp.Options),
		Services: w.service.deserializeStringArray(queuedOp.Services),
	}

	response, err := w.service.operationSvc.StartAndExecuteOperation(
		ctx,
		queuedOp.UserID,
		queuedOp.ServerID,
		queuedOp.StackName,
		operationReq,
		operationLog.ID,
	)

	endTime := time.Now()
	duration := int(endTime.Sub(startTime).Milliseconds())
	success := err == nil

	var exitCode *int
	if !success {
		code := 1
		exitCode = &code
	} else {
		code := 0
		exitCode = &code
	}

	updates := map[string]interface{}{
		"end_time": endTime,
		"success":  success,
		"duration": duration,
		"status":   models.OperationStatusCompleted,
	}

	if !success {
		updates["status"] = models.OperationStatusFailed
	}

	updates["exit_code"] = *exitCode

	err = w.service.db.Model(operationLog).Updates(updates).Error
	if err != nil {
		w.logger.Error("failed to update operation log",
			zap.Error(err),
			zap.String("operation_id", queuedOp.OperationID),
		)
	}

	finalStatus := models.OperationStatusCompleted
	if !success {
		finalStatus = models.OperationStatusFailed
	}

	w.markOperationStatus(queuedOp.OperationID, finalStatus)

	if success && queuedOp.BatchID != nil {
		w.queueNextOperation(*queuedOp.BatchID, queuedOp.Order)
	}

	if success {
		w.logger.Info("operation completed successfully",
			zap.String("operation_id", queuedOp.OperationID),
			zap.String("command", queuedOp.Command),
			zap.Int("duration_ms", duration),
		)
	} else {
		w.logger.Error("operation failed",
			zap.String("operation_id", queuedOp.OperationID),
			zap.String("command", queuedOp.Command),
			zap.Int("duration_ms", duration),
			zap.Error(err),
		)
	}

	if response != nil {
		w.logger.Debug("operation response",
			zap.String("operation_id", queuedOp.OperationID),
			zap.String("response_operation_id", response.OperationID),
		)
	}
}

func (w *StackWorker) waitForDependency(ctx context.Context, dependencyID string) bool {
	w.logger.Debug("waiting for dependency",
		zap.String("dependency_id", dependencyID),
	)

	timeout := time.NewTimer(30 * time.Minute)
	defer timeout.Stop()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return false

		case <-timeout.C:
			w.logger.Warn("dependency wait timeout",
				zap.String("dependency_id", dependencyID),
			)
			return false

		case <-ticker.C:
			var dependency models.QueuedOperation
			err := w.service.db.Where("operation_id = ?", dependencyID).First(&dependency).Error
			if err != nil {
				w.logger.Error("failed to check dependency status",
					zap.Error(err),
					zap.String("dependency_id", dependencyID),
				)
				return false
			}

			switch dependency.Status {
			case models.OperationStatusCompleted:
				w.logger.Debug("dependency completed",
					zap.String("dependency_id", dependencyID),
				)
				return true

			case models.OperationStatusFailed, models.OperationStatusCancelled:
				w.logger.Warn("dependency failed or was cancelled",
					zap.String("dependency_id", dependencyID),
					zap.String("dependency_status", string(dependency.Status)),
				)
				return false

			default:

				w.logger.Debug("dependency still pending",
					zap.String("dependency_id", dependencyID),
					zap.String("dependency_status", string(dependency.Status)),
				)
			}
		}
	}
}

func (w *StackWorker) markOperationStatus(operationID string, status models.OperationStatus) bool {
	err := w.service.db.Model(&models.QueuedOperation{}).
		Where("operation_id = ?", operationID).
		Update("status", status).Error

	if err != nil {
		w.logger.Error("failed to update operation status",
			zap.Error(err),
			zap.String("operation_id", operationID),
			zap.String("status", string(status)),
		)
		return false
	}

	w.logger.Debug("operation status updated",
		zap.String("operation_id", operationID),
		zap.String("status", string(status)),
	)

	return true
}

func (w *StackWorker) queueNextOperation(batchID string, currentOrder int) {
	w.logger.Debug("looking for next operation in batch",
		zap.String("batch_id", batchID),
		zap.Int("current_order", currentOrder),
	)

	var nextOperation models.QueuedOperation
	err := w.service.db.Where("batch_id = ? AND order = ? AND status = ?",
		batchID, currentOrder+1, models.OperationStatusQueued).
		First(&nextOperation).Error

	if err != nil {

		w.logger.Debug("no next operation found in batch",
			zap.String("batch_id", batchID),
			zap.Int("next_order", currentOrder+1),
		)
		return
	}

	w.logger.Debug("queuing next operation in batch",
		zap.String("batch_id", batchID),
		zap.String("next_operation_id", nextOperation.OperationID),
		zap.Int("next_order", nextOperation.Order),
	)

	select {
	case w.queue <- &nextOperation:
		w.logger.Debug("next operation queued successfully",
			zap.String("operation_id", nextOperation.OperationID),
		)
	default:
		w.logger.Error("failed to queue next operation - worker queue full",
			zap.String("operation_id", nextOperation.OperationID),
		)
	}
}
