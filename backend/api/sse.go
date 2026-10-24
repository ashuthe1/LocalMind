package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// sseWriter streams server-sent events with a heartbeat. It is safe for concurrent use.
type sseWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
	mu      sync.Mutex
	closed  bool
	stop    chan struct{}
	done    chan struct{}
}

var errClientGone = errors.New("client disconnected")

func newSSEWriter(w http.ResponseWriter) (*sseWriter, error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, errors.New("streaming unsupported by the server")
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream; charset=utf-8")
	h.Set("Cache-Control", "no-cache, no-transform")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
	s := &sseWriter{w: w, flusher: flusher, stop: make(chan struct{}), done: make(chan struct{})}
	go s.heartbeat()
	return s, nil
}

func (s *sseWriter) heartbeat() {
	defer close(s.done)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.mu.Lock()
			if !s.closed {
				if _, err := fmt.Fprint(s.w, ": ping\n\n"); err == nil {
					s.flusher.Flush()
				}
			}
			s.mu.Unlock()
		case <-s.stop:
			return
		}
	}
}

// Emit sends one event.
func (s *sseWriter) Emit(event string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return errClientGone
	}
	if _, err := fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", event, payload); err != nil {
		s.closed = true
		return errClientGone
	}
	s.flusher.Flush()
	return nil
}

// Close stops the heartbeat.
func (s *sseWriter) Close() {
	s.mu.Lock()
	s.closed = true
	s.mu.Unlock()
	close(s.stop)
	<-s.done
}
