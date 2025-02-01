// utils/utils.go

package utils

import (
	"context"
	"time"
)

// CreateContextWithTimeout creates a new context with a specified timeout.
func CreateContextWithTimeout(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}

// NowUTC returns the current UTC time.
func NowUTC() time.Time {
	return time.Now().UTC()
}
