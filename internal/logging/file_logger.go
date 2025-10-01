package logging

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type FileLogger struct {
	enabled     bool
	logDir      string
	logName     string
	logger      *logging.Service
	currentFile *os.File
	currentDate string
	mu          sync.Mutex
}

func NewFileLogger(enabled bool, logDir string, logName string, logger *logging.Service) (*FileLogger, error) {
	if !enabled {
		logger.Info("file logger disabled",
			zap.String("log_name", logName),
		)
		return &FileLogger{
			enabled: false,
			logName: logName,
			logger:  logger,
		}, nil
	}

	if err := os.MkdirAll(logDir, 0755); err != nil {
		logger.Error("failed to create log directory",
			zap.String("log_name", logName),
			zap.String("dir", logDir),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to create log directory: %w", err)
	}

	logger.Info("file logger initialized",
		zap.String("log_name", logName),
		zap.String("log_dir", logDir),
	)

	return &FileLogger{
		enabled: true,
		logDir:  logDir,
		logName: logName,
		logger:  logger,
	}, nil
}

func (f *FileLogger) Log(entry interface{}) {
	if !f.enabled {
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	if err := f.ensureCurrentLogFile(); err != nil {
		f.logger.Error("failed to ensure log file",
			zap.String("log_name", f.logName),
			zap.Error(err),
		)
		return
	}

	f.writeEntry(entry)
}

func (f *FileLogger) LogAsync(entry interface{}) {
	if !f.enabled {
		return
	}

	go f.Log(entry)
}

func (f *FileLogger) ensureCurrentLogFile() error {
	currentDate := time.Now().Format("2006-01-02")

	if f.currentFile != nil && f.currentDate == currentDate {
		return nil
	}

	if f.currentFile != nil {
		if err := f.currentFile.Close(); err != nil {
			f.logger.Warn("failed to close previous log file",
				zap.String("log_name", f.logName),
				zap.Error(err),
			)
		}
	}

	filename := filepath.Join(f.logDir, fmt.Sprintf("%s-%s.jsonl", f.logName, currentDate))
	file, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	f.currentFile = file
	f.currentDate = currentDate

	f.logger.Debug("opened new log file",
		zap.String("log_name", f.logName),
		zap.String("filename", filename),
	)

	return nil
}

func (f *FileLogger) writeEntry(entry interface{}) {
	data, err := json.Marshal(entry)
	if err != nil {
		f.logger.Error("failed to marshal log entry",
			zap.String("log_name", f.logName),
			zap.Error(err),
		)
		return
	}

	if _, err := f.currentFile.Write(append(data, '\n')); err != nil {
		f.logger.Error("failed to write log entry",
			zap.String("log_name", f.logName),
			zap.Error(err),
		)
		return
	}

	f.logger.Debug("wrote log entry",
		zap.String("log_name", f.logName),
	)
}

func (f *FileLogger) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.currentFile != nil {
		return f.currentFile.Close()
	}
	return nil
}

func (f *FileLogger) Flush() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.currentFile != nil {
		return f.currentFile.Sync()
	}
	return nil
}

func (f *FileLogger) IsEnabled() bool {
	return f.enabled
}

func (f *FileLogger) GetLogDir() string {
	return f.logDir
}

func (f *FileLogger) GetLogName() string {
	return f.logName
}
