package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/ashuthe1/localmind/models"
)

// Anthropic talks to the Anthropic Messages API.
type Anthropic struct {
	base   string
	cfg    models.ProviderConfig
	client *http.Client
}

func (a *Anthropic) Type() string { return "anthropic" }

func (a *Anthropic) auth(req *http.Request) {
	req.Header.Set("x-api-key", a.cfg.APIKey)
	req.Header.Set("anthropic-version", optString(a.cfg.Options, "apiVersion", "2023-06-01"))
}

func (a *Anthropic) ListModels(ctx context.Context) ([]ModelInfo, error) {
	if a.cfg.APIKey == "" {
		return nil, errors.New("an API key is required")
	}
	resp, err := doJSON(ctx, a.client, a.cfg, http.MethodGet, a.base+"/v1/models?limit=100", nil, a.auth)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var payload struct {
		Data []struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decoding model list: %w", err)
	}
	out := make([]ModelInfo, 0, len(payload.Data))
	for _, m := range payload.Data {
		name := m.DisplayName
		if name == "" {
			name = m.ID
		}
		out = append(out, ModelInfo{ID: m.ID, Name: name, Vision: true})
	}
	return out, nil
}

func (a *Anthropic) Stream(ctx context.Context, req Request, emit func(Event) error) error {
	if a.cfg.APIKey == "" {
		return errors.New("an API key is required")
	}
	msgs := make([]map[string]any, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := m.Role
		if role == "system" {
			continue
		}
		if len(m.Images) == 0 {
			msgs = append(msgs, map[string]any{"role": role, "content": m.Content})
			continue
		}
		parts := []map[string]any{}
		for _, img := range m.Images {
			parts = append(parts, map[string]any{"type": "image", "source": map[string]any{"type": "base64", "media_type": img.MimeType, "data": img.Data}})
		}
		if m.Content != "" {
			parts = append(parts, map[string]any{"type": "text", "text": m.Content})
		}
		msgs = append(msgs, map[string]any{"role": role, "content": parts})
	}
	// Anthropic requires alternating roles starting with user; merge consecutive same-role turns.
	msgs = mergeConsecutive(msgs)

	maxTokens := 4096
	if req.Params.MaxTokens != nil && *req.Params.MaxTokens > 0 {
		maxTokens = *req.Params.MaxTokens
	}
	body := map[string]any{
		"model":      req.Model,
		"messages":   msgs,
		"max_tokens": maxTokens,
		"stream":     true,
	}
	if req.System != "" {
		body["system"] = req.System
	}
	if req.Params.Temperature != nil {
		body["temperature"] = *req.Params.Temperature
	}
	if req.Params.TopP != nil && req.Params.Temperature == nil {
		body["top_p"] = *req.Params.TopP
	}
	if len(req.Params.StopSequences) > 0 {
		body["stop_sequences"] = req.Params.StopSequences
	}
	if t := reasoningEnabled(req.Params.Reasoning); t != nil && *t {
		budget := 1024
		switch req.Params.Reasoning {
		case "medium":
			budget = 4096
		case "high":
			budget = 16000
		}
		if budget >= maxTokens {
			maxTokens = budget + 1024
			body["max_tokens"] = maxTokens
		}
		body["thinking"] = map[string]any{"type": "enabled", "budget_tokens": budget}
		delete(body, "temperature") // thinking requires default temperature
		delete(body, "top_p")
	}

	start := time.Now()
	resp, err := doJSON(ctx, a.client, a.cfg, http.MethodPost, a.base+"/v1/messages", body, a.auth)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var stats models.Stats
	err = readSSE(resp.Body, func(event, data string) error {
		if data == "" {
			return nil
		}
		var ev struct {
			Type  string `json:"type"`
			Delta struct {
				Type     string `json:"type"`
				Text     string `json:"text"`
				Thinking string `json:"thinking"`
			} `json:"delta"`
			Message struct {
				Usage struct {
					InputTokens int `json:"input_tokens"`
				} `json:"usage"`
			} `json:"message"`
			Usage struct {
				OutputTokens int `json:"output_tokens"`
			} `json:"usage"`
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &ev); err != nil {
			return nil
		}
		switch ev.Type {
		case "message_start":
			stats.InputTokens = ev.Message.Usage.InputTokens
		case "content_block_delta":
			if ev.Delta.Type == "thinking_delta" && ev.Delta.Thinking != "" {
				return emit(Event{Type: EventReasoning, Text: ev.Delta.Thinking})
			}
			if ev.Delta.Type == "text_delta" && ev.Delta.Text != "" {
				return emit(Event{Type: EventContent, Text: ev.Delta.Text})
			}
		case "message_delta":
			if ev.Usage.OutputTokens > 0 {
				stats.OutputTokens = ev.Usage.OutputTokens
			}
		case "error":
			return fmt.Errorf("anthropic: %s", ev.Error.Message)
		}
		return nil
	})
	if err != nil {
		return err
	}
	return emit(Event{Type: EventDone, Stats: timedStats(&stats, start)})
}

// mergeConsecutive merges adjacent messages with the same role into one, as Anthropic requires alternation.
func mergeConsecutive(msgs []map[string]any) []map[string]any {
	out := make([]map[string]any, 0, len(msgs))
	for _, m := range msgs {
		if n := len(out); n > 0 && out[n-1]["role"] == m["role"] {
			prev := out[n-1]
			out[n-1] = map[string]any{"role": m["role"], "content": append(toParts(prev["content"]), toParts(m["content"])...)}
			continue
		}
		out = append(out, m)
	}
	if len(out) > 0 && out[0]["role"] != "user" {
		out = append([]map[string]any{{"role": "user", "content": "(conversation start)"}}, out...)
	}
	return out
}

func toParts(content any) []map[string]any {
	switch v := content.(type) {
	case string:
		return []map[string]any{{"type": "text", "text": v}}
	case []map[string]any:
		return v
	}
	return nil
}
