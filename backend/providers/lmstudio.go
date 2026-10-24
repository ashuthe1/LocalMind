package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/models"
)

// LMStudio talks to LM Studio's native REST API (/api/v1/chat, /api/v1/models).
//
// The native API is stateful: each call sends only the newest user turn plus a
// previous_response_id. We persist that id in the chat's Meta so multi-turn
// conversations continue server-side. When the chain is missing or was
// invalidated (edits, regeneration, model switch) we fall back to sending the
// whole transcript inline.
type LMStudio struct {
	base   string
	cfg    models.ProviderConfig
	client *http.Client
}

const lmMetaResponseID = "lmstudio_response_id"
const lmMetaTurnCount = "lmstudio_turn_count"

func (l *LMStudio) Type() string { return "lmstudio" }

func (l *LMStudio) auth(req *http.Request) {
	if l.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+l.cfg.APIKey)
	}
}

func (l *LMStudio) ListModels(ctx context.Context) ([]ModelInfo, error) {
	resp, err := doJSON(ctx, l.client, l.cfg, http.MethodGet, l.base+"/api/v1/models", nil, l.auth)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var payload struct {
		Models []struct {
			Type             string `json:"type"`
			Key              string `json:"key"`
			DisplayName      string `json:"display_name"`
			Architecture     string `json:"architecture"`
			SizeBytes        int64  `json:"size_bytes"`
			MaxContextLength int    `json:"max_context_length"`
			LoadedInstances  []any  `json:"loaded_instances"`
			Capabilities     *struct {
				Vision bool `json:"vision"`
			} `json:"capabilities"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decoding model list: %w", err)
	}
	out := []ModelInfo{}
	for _, m := range payload.Models {
		if m.Type != "llm" && m.Type != "vlm" && m.Type != "" {
			continue
		}
		info := ModelInfo{ID: m.Key, Name: m.DisplayName, Loaded: len(m.LoadedInstances) > 0, ContextLength: m.MaxContextLength, Family: m.Architecture, SizeBytes: m.SizeBytes}
		if info.Name == "" {
			info.Name = m.Key
		}
		if m.Capabilities != nil {
			info.Vision = m.Capabilities.Vision
		}
		out = append(out, info)
	}
	return out, nil
}

func (l *LMStudio) Stream(ctx context.Context, req Request, emit func(Event) error) error {
	if len(req.Messages) == 0 {
		return fmt.Errorf("no messages to send")
	}
	last := req.Messages[len(req.Messages)-1]

	// Decide whether we can continue a stored response chain. The chain is valid
	// when the stored turn count equals the number of assistant turns in history,
	// which means nothing was edited, deleted or regenerated since.
	prevID := req.Meta[lmMetaResponseID]
	assistantTurns := 0
	for _, m := range req.Messages {
		if m.Role == "assistant" {
			assistantTurns++
		}
	}
	useChain := prevID != "" && req.Meta[lmMetaTurnCount] == fmt.Sprint(assistantTurns) && assistantTurns > 0 && last.Role == "user"

	// Build the input. Text items use type "text" with a "content" field — LM Studio
	// rejects "type": "message" here (see GitHub issue #6).
	var input []map[string]any
	addText := func(s string) {
		if s != "" {
			input = append(input, map[string]any{"type": "text", "content": s})
		}
	}
	if useChain {
		addText(last.Content)
	} else {
		var transcript strings.Builder
		for i, m := range req.Messages {
			if i == len(req.Messages)-1 {
				break
			}
			label := "User"
			if m.Role == "assistant" {
				label = "Assistant"
			}
			fmt.Fprintf(&transcript, "%s: %s\n\n", label, m.Content)
		}
		if transcript.Len() > 0 {
			addText("Here is the conversation so far:\n\n" + transcript.String() + "Continue the conversation by replying to the user's latest message below.\n\nUser: " + last.Content)
		} else {
			addText(last.Content)
		}
	}
	for _, img := range last.Images {
		input = append(input, map[string]any{"type": "image", "data_url": "data:" + img.MimeType + ";base64," + img.Data})
	}
	if len(input) == 0 {
		addText(" ")
	}

	body := map[string]any{
		"model":  req.Model,
		"input":  input,
		"stream": true,
		"store":  true,
	}
	if req.System != "" {
		body["system_prompt"] = req.System
	}
	if useChain {
		body["previous_response_id"] = prevID
	}
	if req.Params.Temperature != nil {
		body["temperature"] = *req.Params.Temperature
	}
	if req.Params.TopP != nil {
		body["top_p"] = *req.Params.TopP
	}
	if req.Params.MaxTokens != nil {
		body["max_output_tokens"] = *req.Params.MaxTokens
	}
	if req.Params.ContextLength != nil {
		body["context_length"] = *req.Params.ContextLength
	}
	switch strings.ToLower(req.Params.Reasoning) {
	case "off", "low", "medium", "high", "on":
		body["reasoning"] = strings.ToLower(req.Params.Reasoning)
	}

	start := time.Now()
	resp, err := doJSON(ctx, l.client, l.cfg, http.MethodPost, l.base+"/api/v1/chat", body, l.auth)
	if err != nil {
		if he, ok := err.(*HTTPError); ok && he.Status == 400 && body["reasoning"] != nil {
			delete(body, "reasoning")
			resp, err = doJSON(ctx, l.client, l.cfg, http.MethodPost, l.base+"/api/v1/chat", body, l.auth)
		}
		if err != nil {
			return err
		}
	}
	defer resp.Body.Close()

	var stats models.Stats
	var responseID string
	var streamErr error
	err = readSSE(resp.Body, func(_ string, data string) error {
		if data == "" {
			return nil
		}
		var ev struct {
			Type     string  `json:"type"`
			Content  string  `json:"content"`
			Progress float64 `json:"progress"`
			Error    *struct {
				Message string `json:"message"`
			} `json:"error"`
			Result *struct {
				ResponseID string `json:"response_id"`
				Stats      struct {
					InputTokens       int `json:"input_tokens"`
					TotalOutputTokens int `json:"total_output_tokens"`
				} `json:"stats"`
			} `json:"result"`
		}
		if err := json.Unmarshal([]byte(data), &ev); err != nil {
			return nil
		}
		switch ev.Type {
		case "model_load.start":
			return emit(Event{Type: EventStatus, Text: "Loading model…"})
		case "model_load.progress":
			return emit(Event{Type: EventStatus, Text: fmt.Sprintf("Loading model… %d%%", int(ev.Progress*100))})
		case "prompt_processing.progress":
			return emit(Event{Type: EventStatus, Text: fmt.Sprintf("Processing prompt… %d%%", int(ev.Progress*100))})
		case "reasoning.delta":
			return emit(Event{Type: EventReasoning, Text: ev.Content})
		case "message.delta":
			return emit(Event{Type: EventContent, Text: ev.Content})
		case "error":
			if ev.Error != nil {
				streamErr = fmt.Errorf("lm studio: %s", ev.Error.Message)
			}
		case "chat.end":
			if ev.Result != nil {
				responseID = ev.Result.ResponseID
				stats.InputTokens = ev.Result.Stats.InputTokens
				stats.OutputTokens = ev.Result.Stats.TotalOutputTokens
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	if streamErr != nil {
		return streamErr
	}
	meta := map[string]string{}
	if responseID != "" {
		meta[lmMetaResponseID] = responseID
		meta[lmMetaTurnCount] = fmt.Sprint(assistantTurns + 1)
	}
	return emit(Event{Type: EventDone, Stats: timedStats(&stats, start), Meta: meta})
}
