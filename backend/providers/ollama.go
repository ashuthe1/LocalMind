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

// Ollama talks to the Ollama HTTP API (/api/chat, /api/tags).
type Ollama struct {
	base   string
	cfg    models.ProviderConfig
	client *http.Client
}

func (o *Ollama) Type() string { return "ollama" }

func (o *Ollama) auth(req *http.Request) {
	if o.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+o.cfg.APIKey)
	}
}

func (o *Ollama) ListModels(ctx context.Context) ([]ModelInfo, error) {
	resp, err := doJSON(ctx, o.client, o.cfg, http.MethodGet, o.base+"/api/tags", nil, o.auth)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var payload struct {
		Models []struct {
			Name    string `json:"name"`
			Model   string `json:"model"`
			Size    int64  `json:"size"`
			Details struct {
				Family   string   `json:"family"`
				Families []string `json:"families"`
			} `json:"details"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decoding model list: %w", err)
	}
	out := make([]ModelInfo, 0, len(payload.Models))
	for _, m := range payload.Models {
		id := m.Model
		if id == "" {
			id = m.Name
		}
		vision := false
		for _, f := range m.Details.Families {
			if f == "clip" || f == "mllama" || strings.Contains(f, "vision") {
				vision = true
			}
		}
		lower := strings.ToLower(id)
		if strings.Contains(lower, "vision") || strings.Contains(lower, "llava") || strings.Contains(lower, "vl") || strings.Contains(lower, "gemma3") || strings.Contains(lower, "moondream") || strings.Contains(lower, "minicpm-v") {
			vision = true
		}
		out = append(out, ModelInfo{ID: id, Name: strings.TrimSuffix(id, ":latest"), Vision: vision, Family: m.Details.Family, SizeBytes: m.Size})
	}
	return out, nil
}

func (o *Ollama) Stream(ctx context.Context, req Request, emit func(Event) error) error {
	type msg struct {
		Role    string   `json:"role"`
		Content string   `json:"content"`
		Images  []string `json:"images,omitempty"`
	}
	msgs := make([]msg, 0, len(req.Messages)+1)
	if req.System != "" {
		msgs = append(msgs, msg{Role: "system", Content: req.System})
	}
	for _, m := range req.Messages {
		om := msg{Role: m.Role, Content: m.Content}
		for _, img := range m.Images {
			om.Images = append(om.Images, img.Data)
		}
		msgs = append(msgs, om)
	}

	options := map[string]any{}
	if req.Params.Temperature != nil {
		options["temperature"] = *req.Params.Temperature
	}
	if req.Params.TopP != nil {
		options["top_p"] = *req.Params.TopP
	}
	if req.Params.MaxTokens != nil {
		options["num_predict"] = *req.Params.MaxTokens
	}
	if req.Params.ContextLength != nil {
		options["num_ctx"] = *req.Params.ContextLength
	}
	if req.Params.Seed != nil {
		options["seed"] = *req.Params.Seed
	}
	if len(req.Params.StopSequences) > 0 {
		options["stop"] = req.Params.StopSequences
	}

	body := map[string]any{
		"model":    req.Model,
		"messages": msgs,
		"stream":   true,
		"options":  options,
	}
	if ka := optString(o.cfg.Options, "keepAlive", ""); ka != "" {
		body["keep_alive"] = ka
	}
	switch strings.ToLower(req.Params.Reasoning) {
	case "low", "medium", "high":
		body["think"] = strings.ToLower(req.Params.Reasoning)
	default:
		if t := reasoningEnabled(req.Params.Reasoning); t != nil {
			body["think"] = *t
		}
	}

	start := time.Now()
	resp, err := doJSON(ctx, o.client, o.cfg, http.MethodPost, o.base+"/api/chat", body, o.auth)
	if err != nil {
		// Older Ollama versions reject the think field; retry without it.
		if he, ok := err.(*HTTPError); ok && he.Status == 400 && body["think"] != nil && strings.Contains(strings.ToLower(he.Body), "think") {
			delete(body, "think")
			resp, err = doJSON(ctx, o.client, o.cfg, http.MethodPost, o.base+"/api/chat", body, o.auth)
		}
		if err != nil {
			return err
		}
	}
	defer resp.Body.Close()

	var stats models.Stats
	err = readNDJSON(resp.Body, func(line []byte) error {
		var chunk struct {
			Message struct {
				Content  string `json:"content"`
				Thinking string `json:"thinking"`
			} `json:"message"`
			Done            bool   `json:"done"`
			PromptEvalCount int    `json:"prompt_eval_count"`
			EvalCount       int    `json:"eval_count"`
			Error           string `json:"error"`
		}
		if err := json.Unmarshal(line, &chunk); err != nil {
			return nil // ignore malformed keep-alive lines
		}
		if chunk.Error != "" {
			return fmt.Errorf("ollama: %s", chunk.Error)
		}
		if chunk.Message.Thinking != "" {
			if err := emit(Event{Type: EventReasoning, Text: chunk.Message.Thinking}); err != nil {
				return err
			}
		}
		if chunk.Message.Content != "" {
			if err := emit(Event{Type: EventContent, Text: chunk.Message.Content}); err != nil {
				return err
			}
		}
		if chunk.Done {
			stats.InputTokens = chunk.PromptEvalCount
			stats.OutputTokens = chunk.EvalCount
		}
		return nil
	})
	if err != nil {
		return err
	}
	return emit(Event{Type: EventDone, Stats: timedStats(&stats, start)})
}
