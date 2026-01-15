package logging

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/tech-arch1tect/brx/services/logging"
	"go.uber.org/zap"
)

type FileLogger struct {
	enabled       bool
	logDir        string
	logName       string
	logger        *logging.Service
	currentFile   *os.File
	currentDate   string
	currentSeqNum int
	maxSizeBytes  int64
	mu            sync.Mutex
}

func NewFileLogger(enabled bool, logDir string, logName string, logger *logging.Service, maxSizeBytes int64) (*FileLogger, error) {
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

	f := &FileLogger{
		enabled:      true,
		logDir:       logDir,
		logName:      logName,
		logger:       logger,
		maxSizeBytes: maxSizeBytes,
		currentDate:  time.Now().Format("2006-01-02"),
	}

	if err := f.scanExistingSequenceNumber(); err != nil {
		logger.Warn("failed to scan existing sequence numbers",
			zap.String("log_name", logName),
			zap.Error(err),
		)
	}

	if err := f.openCurrentFile(); err != nil {
		return nil, err
	}

	logger.Info("file logger initialized",
		zap.String("log_name", logName),
		zap.String("log_dir", logDir),
		zap.Int64("max_size_bytes", maxSizeBytes),
		zap.Int("current_seq_num", f.currentSeqNum),
	)

	return f, nil
}

func (f *FileLogger) currentFilePath() string {
	return filepath.Join(f.logDir, fmt.Sprintf("%s-current.jsonl", f.logName))
}

func (f *FileLogger) rotatedFilePath(date string, seqNum int) string {
	if seqNum == 0 {
		return filepath.Join(f.logDir, fmt.Sprintf("%s-%s.jsonl", f.logName, date))
	}
	return filepath.Join(f.logDir, fmt.Sprintf("%s-%s-%d.jsonl", f.logName, date, seqNum))
}

func (f *FileLogger) scanExistingSequenceNumber() error {

	pattern := regexp.MustCompile(fmt.Sprintf(`^%s-%s-(\d+)\.jsonl$`, regexp.QuoteMeta(f.logName), regexp.QuoteMeta(f.currentDate)))

	entries, err := os.ReadDir(f.logDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	maxSeq := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		matches := pattern.FindStringSubmatch(entry.Name())
		if len(matches) == 2 {
			if seq, err := strconv.Atoi(matches[1]); err == nil && seq > maxSeq {
				maxSeq = seq
			}
		}
	}

	baseDatedFile := filepath.Join(f.logDir, fmt.Sprintf("%s-%s.jsonl", f.logName, f.currentDate))
	if _, err := os.Stat(baseDatedFile); err == nil {

		if maxSeq == 0 {
			maxSeq = 0
		}
	}

	f.currentSeqNum = maxSeq
	return nil
}

func (f *FileLogger) openCurrentFile() error {
	path := f.currentFilePath()
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file %s: %w", path, err)
	}
	f.currentFile = file

	f.logger.Debug("opened current log file",
		zap.String("log_name", f.logName),
		zap.String("path", path),
	)

	return nil
}

func (f *FileLogger) rotateMidnight(previousDate string) error {

	if f.currentFile != nil {
		if err := f.currentFile.Close(); err != nil {
			f.logger.Warn("failed to close current log file during midnight rotation",
				zap.String("log_name", f.logName),
				zap.Error(err),
			)
		}
		f.currentFile = nil
	}

	currentPath := f.currentFilePath()

	info, err := os.Stat(currentPath)
	if err == nil && info.Size() > 0 {

		var rotatedPath string
		if f.currentSeqNum > 0 {

			rotatedPath = f.rotatedFilePath(previousDate, f.currentSeqNum+1)
		} else {

			rotatedPath = f.rotatedFilePath(previousDate, 0)
		}

		if err := os.Rename(currentPath, rotatedPath); err != nil {
			f.logger.Error("failed to rotate log file at midnight",
				zap.String("log_name", f.logName),
				zap.String("from", currentPath),
				zap.String("to", rotatedPath),
				zap.Error(err),
			)
			return fmt.Errorf("failed to rotate log file: %w", err)
		}

		f.logger.Info("rotated log file at midnight",
			zap.String("log_name", f.logName),
			zap.String("rotated_to", rotatedPath),
		)
	}

	f.currentSeqNum = 0

	return f.openCurrentFile()
}

func (f *FileLogger) rotateSize() error {

	if f.currentFile != nil {
		if err := f.currentFile.Close(); err != nil {
			f.logger.Warn("failed to close current log file during size rotation",
				zap.String("log_name", f.logName),
				zap.Error(err),
			)
		}
		f.currentFile = nil
	}

	currentPath := f.currentFilePath()

	f.currentSeqNum++

	rotatedPath := f.rotatedFilePath(f.currentDate, f.currentSeqNum)
	if err := os.Rename(currentPath, rotatedPath); err != nil {
		f.logger.Error("failed to rotate log file by size",
			zap.String("log_name", f.logName),
			zap.String("from", currentPath),
			zap.String("to", rotatedPath),
			zap.Error(err),
		)
		return fmt.Errorf("failed to rotate log file: %w", err)
	}

	f.logger.Info("rotated log file by size",
		zap.String("log_name", f.logName),
		zap.String("rotated_to", rotatedPath),
		zap.Int("seq_num", f.currentSeqNum),
	)

	return f.openCurrentFile()
}

func (f *FileLogger) ensureCurrentLogFile() error {
	today := time.Now().Format("2006-01-02")

	if f.currentDate != "" && f.currentDate != today {
		previousDate := f.currentDate
		f.currentDate = today
		if err := f.rotateMidnight(previousDate); err != nil {
			return err
		}
		return nil
	}

	if f.currentFile == nil {
		f.currentDate = today
		return f.openCurrentFile()
	}

	return nil
}

func (f *FileLogger) checkSizeRotation() {
	if f.maxSizeBytes <= 0 || f.currentFile == nil {
		return
	}

	info, err := f.currentFile.Stat()
	if err != nil {
		f.logger.Warn("failed to stat current log file for size check",
			zap.String("log_name", f.logName),
			zap.Error(err),
		)
		return
	}

	if info.Size() >= f.maxSizeBytes {
		if err := f.rotateSize(); err != nil {
			f.logger.Error("failed to rotate log file by size",
				zap.String("log_name", f.logName),
				zap.Error(err),
			)
		}
	}
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

	f.checkSizeRotation()
}

func (f *FileLogger) LogAsync(entry interface{}) {
	if !f.enabled {
		return
	}

	go f.Log(entry)
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
