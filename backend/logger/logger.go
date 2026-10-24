// Package logger configures application logging (console + daily files).
package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/sirupsen/logrus"
)

// Log is the shared logger.
var Log = logrus.New()

// Init sets up console output plus daily JSON log files under dir.
func Init(dir, level string) {
	lvl, err := logrus.ParseLevel(level)
	if err != nil {
		lvl = logrus.InfoLevel
	}
	Log.SetLevel(lvl)
	Log.SetFormatter(&logrus.TextFormatter{FullTimestamp: true, TimestampFormat: "15:04:05"})
	Log.SetOutput(os.Stdout)

	if dir == "" {
		return
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		Log.Warnf("Could not create log directory %s: %v", dir, err)
		return
	}
	date := time.Now().Format("2006-01-02")
	file, err := os.OpenFile(filepath.Join(dir, fmt.Sprintf("%s.log", date)), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		Log.Warnf("Could not open log file: %v", err)
		return
	}
	fileLogger := logrus.New()
	fileLogger.SetOutput(file)
	fileLogger.SetFormatter(&logrus.JSONFormatter{})
	fileLogger.SetLevel(lvl)
	Log.AddHook(&teeHook{fileLogger})
	_ = io.Discard
}

type teeHook struct{ target *logrus.Logger }

func (h *teeHook) Levels() []logrus.Level { return logrus.AllLevels }

func (h *teeHook) Fire(entry *logrus.Entry) error {
	e := h.target.WithFields(entry.Data)
	e.Time = entry.Time
	e.Log(entry.Level, entry.Message)
	return nil
}
