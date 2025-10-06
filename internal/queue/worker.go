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
		Command:     queuedOp.Command,
		Options:     queuedOp.Options,
		Services:    queuedOp.Services,
		Status:      models.OperationStatusRunning,
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

	operationCtx, cancel := context.WithTimeout(ctx, time.Duration(w.service.operationTimeoutSeconds)*time.Second)
	defer cancel()

	response, err := w.service.operationSvc.StartAndExecuteOperation(
		operationCtx,
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
