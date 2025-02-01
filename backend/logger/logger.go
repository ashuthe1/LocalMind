package logger

import (
	"fmt"
	"os"
	"time"

	"github.com/sirupsen/logrus"
)

var Log *logrus.Logger

func InitLogger() {
	Log = logrus.New()
	Log.SetFormatter(&logrus.JSONFormatter{})

	// Create logs directory if not exists
	if _, err := os.Stat("logs"); os.IsNotExist(err) {
		os.Mkdir("logs", os.ModePerm)
	}

	// Set log file paths
	date := time.Now().Format("2006-01-02") // YYYY-MM-DD
	logFile, err := os.OpenFile(fmt.Sprintf("logs/%s-normal.log", date), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		Log.Fatalf("Failed to open log file: %v", err)
	}

	errorFile, err := os.OpenFile(fmt.Sprintf("logs/%s-error.log", date), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		Log.Fatalf("Failed to open error log file: %v", err)
	}

	// Log to multiple outputs
	Log.SetOutput(logFile)
	Log.SetLevel(logrus.InfoLevel)

	// Separate error logs
	errorLogger := logrus.New()
	errorLogger.SetOutput(errorFile)
	errorLogger.SetLevel(logrus.ErrorLevel)

	// Hook to write errors to error log file
	Log.AddHook(&ErrorHook{errorLogger})
}

type ErrorHook struct {
	ErrorLogger *logrus.Logger
}

func (hook *ErrorHook) Levels() []logrus.Level {
	return []logrus.Level{logrus.ErrorLevel, logrus.FatalLevel, logrus.PanicLevel}
}

func (hook *ErrorHook) Fire(entry *logrus.Entry) error {
	line, err := entry.String()
	if err != nil {
		return err
	}
	hook.ErrorLogger.Out.Write([]byte(line))
	return nil
}
