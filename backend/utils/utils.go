// Package utils holds small helpers shared across packages.
package utils

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

// NewID returns a 24-character hex identifier (same shape as a Mongo ObjectID).
func NewID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		// Fall back to a time-based id; practically unreachable.
		t := time.Now().UnixNano()
		for i := 0; i < 8; i++ {
			b[i] = byte(t >> (8 * i))
		}
	}
	return hex.EncodeToString(b)
}

// NowUTC returns the current UTC time.
func NowUTC() time.Time {
	return time.Now().UTC()
}

// Ptr returns a pointer to v.
func Ptr[T any](v T) *T { return &v }
