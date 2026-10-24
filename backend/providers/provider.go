// Package providers implements the LLM backends LocalMind can talk to.
package providers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/models"
)

// EventType classifies a streaming event.
type EventType string

const (
	EventContent   EventType = "content"
	EventReasoning EventType = "reasoning"
	EventStatus    EventType = "status"
	EventDone      EventType = "done"
)

// Event is a streamed chunk from a provider.
type Event struct {
	Type  EventType
	Text  string
	Stats *models.Stats     // only on EventDone, when the provider reports usage
	Meta  map[string]string // provider-specific state to persist on the chat (e.g. LM Studio response id)
}

// Image is an inline image for a multimodal request.
type Image struct {
	MimeType string
	Data     string // base64, no data: prefix
}

// Message is one turn of conversation sent to a provider.
type Message struct {
	Role    string
	Content string
	Images  []Image
}

// Request is a provider-agnostic chat completion request.
type Request struct {
	Model    string
	System   string
	Messages []Message
	Params   models.GenerationParams
	Meta     map[string]string // chat-scoped provider state from a previous turn
}

// ModelInfo describes a model offered by a provider.
type ModelInfo struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Vision        bool   `json:"vision"`
	Loaded        bool   `json:"loaded"`
	ContextLength int    `json:"contextLength,omitempty"`
	Family        string `json:"family,omitempty"`
	SizeBytes     int64  `json:"sizeBytes,omitempty"`
}

// Provider is implemented by every LLM backend.
type Provider interface {
	Type() string
	ListModels(ctx context.Context) ([]ModelInfo, error)
	Stream(ctx context.Context, req Request, emit func(Event) error) error
}

// TypeInfo describes a provider implementation for the catalog.
type TypeInfo struct {
	Type              string `json:"type"`
	Label             string `json:"label"`
	SupportsModelList bool   `json:"supportsModelList"`
	SupportsVision    bool   `json:"supportsVision"`
	NeedsAPIKey       bool   `json:"needsApiKey"`
}

// Preset is a ready-made provider configuration shown in the UI.
type Preset struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	BaseURL     string `json:"baseUrl"`
	NeedsAPIKey bool   `json:"needsApiKey"`
	Local       bool   `json:"local"`
	DocsURL     string `json:"docsUrl,omitempty"`
}

// Types lists the implemented provider types.
func Types() []TypeInfo {
	return []TypeInfo{
		{Type: "ollama", Label: "Ollama", SupportsModelList: true, SupportsVision: true},
		{Type: "openai", Label: "OpenAI-compatible", SupportsModelList: true, SupportsVision: true},
		{Type: "anthropic", Label: "Anthropic", SupportsModelList: true, SupportsVision: true, NeedsAPIKey: true},
		{Type: "gemini", Label: "Google Gemini", SupportsModelList: true, SupportsVision: true, NeedsAPIKey: true},
		{Type: "lmstudio", Label: "LM Studio (native API)", SupportsModelList: true, SupportsVision: true},
	}
}

// Presets lists ready-made configurations.
func Presets() []Preset {
	return []Preset{
		{ID: "ollama", Name: "Ollama", Type: "ollama", BaseURL: "http://localhost:11434", Local: true, DocsURL: "https://ollama.com"},
		{ID: "lmstudio", Name: "LM Studio", Type: "lmstudio", BaseURL: "http://localhost:1234", Local: true, DocsURL: "https://lmstudio.ai/docs/developer/rest"},
		{ID: "lmstudio-openai", Name: "LM Studio (OpenAI compat)", Type: "openai", BaseURL: "http://localhost:1234/v1", Local: true, DocsURL: "https://lmstudio.ai/docs/developer/openai-compat"},
		{ID: "llamacpp", Name: "llama.cpp server", Type: "openai", BaseURL: "http://localhost:8080/v1", Local: true, DocsURL: "https://github.com/ggml-org/llama.cpp/tree/master/tools/server"},
		{ID: "vllm", Name: "vLLM", Type: "openai", BaseURL: "http://localhost:8000/v1", Local: true, DocsURL: "https://docs.vllm.ai"},
		{ID: "localai", Name: "LocalAI", Type: "openai", BaseURL: "http://localhost:8080/v1", Local: true, DocsURL: "https://localai.io"},
		{ID: "jan", Name: "Jan", Type: "openai", BaseURL: "http://localhost:1337/v1", Local: true, DocsURL: "https://jan.ai"},
		{ID: "openai", Name: "OpenAI", Type: "openai", BaseURL: "https://api.openai.com/v1", NeedsAPIKey: true, DocsURL: "https://platform.openai.com/docs"},
		{ID: "anthropic", Name: "Anthropic", Type: "anthropic", BaseURL: "https://api.anthropic.com", NeedsAPIKey: true, DocsURL: "https://docs.anthropic.com"},
		{ID: "gemini", Name: "Google Gemini", Type: "gemini", BaseURL: "https://generativelanguage.googleapis.com/v1beta", NeedsAPIKey: true, DocsURL: "https://ai.google.dev/gemini-api/docs"},
		{ID: "openrouter", Name: "OpenRouter", Type: "openai", BaseURL: "https://openrouter.ai/api/v1", NeedsAPIKey: true, DocsURL: "https://openrouter.ai/docs"},
		{ID: "groq", Name: "Groq", Type: "openai", BaseURL: "https://api.groq.com/openai/v1", NeedsAPIKey: true, DocsURL: "https://console.groq.com/docs"},
		{ID: "deepseek", Name: "DeepSeek", Type: "openai", BaseURL: "https://api.deepseek.com/v1", NeedsAPIKey: true, DocsURL: "https://api-docs.deepseek.com"},
		{ID: "mistral", Name: "Mistral", Type: "openai", BaseURL: "https://api.mistral.ai/v1", NeedsAPIKey: true, DocsURL: "https://docs.mistral.ai"},
		{ID: "xai", Name: "xAI (Grok)", Type: "openai", BaseURL: "https://api.x.ai/v1", NeedsAPIKey: true, DocsURL: "https://docs.x.ai"},
		{ID: "together", Name: "Together AI", Type: "openai", BaseURL: "https://api.together.xyz/v1", NeedsAPIKey: true, DocsURL: "https://docs.together.ai"},
		{ID: "fireworks", Name: "Fireworks AI", Type: "openai", BaseURL: "https://api.fireworks.ai/inference/v1", NeedsAPIKey: true, DocsURL: "https://docs.fireworks.ai"},
		{ID: "cerebras", Name: "Cerebras", Type: "openai", BaseURL: "https://api.cerebras.ai/v1", NeedsAPIKey: true, DocsURL: "https://inference-docs.cerebras.ai"},
		{ID: "perplexity", Name: "Perplexity", Type: "openai", BaseURL: "https://api.perplexity.ai", NeedsAPIKey: true, DocsURL: "https://docs.perplexity.ai"},
		{ID: "custom", Name: "Custom OpenAI-compatible", Type: "openai", BaseURL: ""},
	}
}

// New builds a Provider from its configuration.
func New(cfg models.ProviderConfig) (Provider, error) {
	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	client := &http.Client{Timeout: 0} // streaming: rely on context for cancellation
	switch cfg.Type {
	case "ollama":
		if base == "" {
			base = "http://localhost:11434"
		}
		return &Ollama{base: base, cfg: cfg, client: client}, nil
	case "openai":
		if base == "" {
			return nil, errors.New("base URL is required for OpenAI-compatible providers")
		}
		return &OpenAI{base: base, cfg: cfg, client: client}, nil
	case "anthropic":
		if base == "" {
			base = "https://api.anthropic.com"
		}
		return &Anthropic{base: base, cfg: cfg, client: client}, nil
	case "gemini":
		if base == "" {
			base = "https://generativelanguage.googleapis.com/v1beta"
		}
		return &Gemini{base: base, cfg: cfg, client: client}, nil
	case "lmstudio":
		if base == "" {
			base = "http://localhost:1234"
		}
		return &LMStudio{base: base, cfg: cfg, client: client}, nil
	default:
		return nil, fmt.Errorf("unknown provider type %q", cfg.Type)
	}
}

// ---------- shared HTTP helpers ----------

func applyHeaders(req *http.Request, cfg models.ProviderConfig) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("User-Agent", "LocalMind/2.0")
	for k, v := range cfg.Headers {
		if k != "" {
			req.Header.Set(k, v)
		}
	}
}

func doJSON(ctx context.Context, client *http.Client, cfg models.ProviderConfig, method, url string, body any, auth func(*http.Request)) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = strings.NewReader(string(b))
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, err
	}
	applyHeaders(req, cfg)
	if auth != nil {
		auth(req)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, friendlyNetError(err, url)
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
		return nil, &HTTPError{Status: resp.StatusCode, Body: strings.TrimSpace(string(raw)), URL: url}
	}
	return resp, nil
}

// HTTPError is a non-2xx response from a provider.
type HTTPError struct {
	Status int
	Body   string
	URL    string
}

func (e *HTTPError) Error() string {
	msg := extractErrorMessage(e.Body)
	if msg == "" {
		msg = http.StatusText(e.Status)
	}
	return fmt.Sprintf("provider returned HTTP %d: %s", e.Status, msg)
}

// extractErrorMessage pulls a human message out of common error payload shapes.
func extractErrorMessage(body string) string {
	var payload map[string]any
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		if len(body) > 300 {
			return body[:300] + "…"
		}
		return body
	}
	if e, ok := payload["error"]; ok {
		switch v := e.(type) {
		case string:
			return v
		case map[string]any:
			if m, ok := v["message"].(string); ok {
				return m
			}
		}
	}
	if m, ok := payload["message"].(string); ok {
		return m
	}
	if m, ok := payload["detail"].(string); ok {
		return m
	}
	if len(body) > 300 {
		return body[:300] + "…"
	}
	return body
}

func friendlyNetError(err error, url string) error {
	if errors.Is(err, context.Canceled) {
		return err
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("timed out connecting to %s", url)
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "connection refused"):
		return fmt.Errorf("connection refused at %s — is the server running?", url)
	case strings.Contains(msg, "no such host"):
		return fmt.Errorf("could not resolve host for %s", url)
	}
	return err
}

// readSSE reads a text/event-stream body and calls fn for each event (event name may be empty).
func readSSE(body io.Reader, fn func(event, data string) error) error {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
	var event string
	var data strings.Builder
	flush := func() error {
		if data.Len() == 0 && event == "" {
			return nil
		}
		err := fn(event, strings.TrimSuffix(data.String(), "\n"))
		event = ""
		data.Reset()
		return err
	}
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case line == "":
			if err := flush(); err != nil {
				return err
			}
		case strings.HasPrefix(line, ":"):
			// comment / heartbeat
		case strings.HasPrefix(line, "event:"):
			event = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		case strings.HasPrefix(line, "data:"):
			data.WriteString(strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
			data.WriteString("\n")
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return flush()
}

// readNDJSON reads newline-delimited JSON objects.
func readNDJSON(body io.Reader, fn func(line []byte) error) error {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if err := fn([]byte(line)); err != nil {
			return err
		}
	}
	return scanner.Err()
}

// ---------- option helpers ----------

func optString(opts map[string]any, key, def string) string {
	if opts == nil {
		return def
	}
	if v, ok := opts[key].(string); ok && v != "" {
		return v
	}
	return def
}

func optBool(opts map[string]any, key string, def bool) bool {
	if opts == nil {
		return def
	}
	if v, ok := opts[key].(bool); ok {
		return v
	}
	return def
}

// reasoningEnabled interprets the reasoning setting: auto → nil (don't send), on/low/medium/high → true, off → false.
func reasoningEnabled(level string) *bool {
	switch strings.ToLower(level) {
	case "", "auto":
		return nil
	case "off", "false", "none":
		f := false
		return &f
	default:
		t := true
		return &t
	}
}

// reasoningEffort maps our levels to OpenAI-style effort strings ("" = don't send).
func reasoningEffort(level string) string {
	switch strings.ToLower(level) {
	case "low", "medium", "high":
		return level
	default:
		return ""
	}
}

// timedStats finalizes stats with duration and throughput.
func timedStats(st *models.Stats, start time.Time) *models.Stats {
	if st == nil {
		st = &models.Stats{}
	}
	st.DurationMs = time.Since(start).Milliseconds()
	if st.OutputTokens > 0 && st.DurationMs > 0 {
		st.TokensPerSecond = float64(st.OutputTokens) / (float64(st.DurationMs) / 1000)
	}
	return st
}
