package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/models"
)

// OpenAI talks to any OpenAI-compatible chat completions API.
type OpenAI struct {
	base   string
	cfg    models.ProviderConfig
	client *http.Client
}

func (o *OpenAI) Type() string { return "openai" }

func (o *OpenAI) auth(req *http.Request) {
	if o.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+o.cfg.APIKey)
		// Azure OpenAI uses api-key instead of a bearer token; sending both is harmless.
		if strings.Contains(o.base, "openai.azure.com") {
			req.Header.Set("api-key", o.cfg.APIKey)
		}
	}
	if strings.Contains(o.base, "openrouter.ai") {
		req.Header.Set("HTTP-Referer", "https://github.com/ashuthe1/LocalMind")
		req.Header.Set("X-Title", "LocalMind")
	}
}

func (o *OpenAI) ListModels(ctx context.Context) ([]ModelInfo, error) {
	resp, err := doJSON(ctx, o.client, o.cfg, http.MethodGet, o.base+"/models", nil, o.auth)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var payload struct {
		Data []struct {
			ID           string `json:"id"`
			Name         string `json:"name"`
			Architecture *struct {
				InputModalities []string `json:"input_modalities"`
			} `json:"architecture"`
			ContextLength int `json:"context_length"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decoding model list: %w", err)
	}
	out := make([]ModelInfo, 0, len(payload.Data))
	for _, m := range payload.Data {
		info := ModelInfo{ID: m.ID, Name: m.ID, ContextLength: m.ContextLength}
		if m.Name != "" {
			info.Name = m.Name
		}
		if m.Architecture != nil {
			for _, mod := range m.Architecture.InputModalities {
				if mod == "image" {
					info.Vision = true
				}
			}
		}
		lower := strings.ToLower(m.ID)
		if strings.Contains(lower, "vision") || strings.HasPrefix(lower, "gpt-4o") || strings.HasPrefix(lower, "gpt-4.1") || strings.HasPrefix(lower, "gpt-5") || strings.HasPrefix(lower, "o3") || strings.HasPrefix(lower, "o4") || strings.Contains(lower, "llava") || strings.Contains(lower, "pixtral") || strings.Contains(lower, "-vl") {
			info.Vision = true
		}
		out = append(out, info)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (o *OpenAI) Stream(ctx context.Context, req Request, emit func(Event) error) error {
	msgs := make([]map[string]any, 0, len(req.Messages)+1)
	if req.System != "" {
		role := "system"
		if optBool(o.cfg.Options, "useDeveloperRole", false) {
			role = "developer"
		}
		msgs = append(msgs, map[string]any{"role": role, "content": req.System})
	}
	for _, m := range req.Messages {
		if len(m.Images) == 0 {
			msgs = append(msgs, map[string]any{"role": m.Role, "content": m.Content})
			continue
		}
		parts := []map[string]any{}
		if m.Content != "" {
			parts = append(parts, map[string]any{"type": "text", "text": m.Content})
		}
		for _, img := range m.Images {
			parts = append(parts, map[string]any{"type": "image_url", "image_url": map[string]any{"url": "data:" + img.MimeType + ";base64," + img.Data}})
		}
		msgs = append(msgs, map[string]any{"role": m.Role, "content": parts})
	}

	body := map[string]any{
		"model":    req.Model,
		"messages": msgs,
		"stream":   true,
	}
	if optBool(o.cfg.Options, "streamUsage", true) {
		body["stream_options"] = map[string]any{"include_usage": true}
	}
	if req.Params.Temperature != nil {
		body["temperature"] = *req.Params.Temperature
	}
	if req.Params.TopP != nil {
		body["top_p"] = *req.Params.TopP
	}
	if req.Params.MaxTokens != nil {
		if optBool(o.cfg.Options, "useMaxCompletionTokens", false) {
			body["max_completion_tokens"] = *req.Params.MaxTokens
		} else {
			body["max_tokens"] = *req.Params.MaxTokens
		}
	}
	if req.Params.Seed != nil {
		body["seed"] = *req.Params.Seed
	}
	if len(req.Params.StopSequences) > 0 {
		body["stop"] = req.Params.StopSequences
	}
	if effort := reasoningEffort(req.Params.Reasoning); effort != "" && optBool(o.cfg.Options, "sendReasoningEffort", true) {
		body["reasoning_effort"] = effort
	}

	start := time.Now()
	resp, err := o.post(ctx, body)
	if err != nil {
		// Many servers reject unknown fields; retry once with the bare essentials.
		if he, ok := err.(*HTTPError); ok && (he.Status == 400 || he.Status == 422) {
			delete(body, "stream_options")
			delete(body, "reasoning_effort")
			if req.Params.MaxTokens != nil {
				delete(body, "max_tokens")
				body["max_completion_tokens"] = *req.Params.MaxTokens
			}
			if resp, err = o.post(ctx, body); err != nil {
				return err
			}
		} else {
			return err
		}
	}
	defer resp.Body.Close()

	var stats models.Stats
	err = readSSE(resp.Body, func(_ string, data string) error {
		if data == "" || data == "[DONE]" {
			return nil
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content          string `json:"content"`
					ReasoningContent string `json:"reasoning_content"`
					Reasoning        string `json:"reasoning"`
				} `json:"delta"`
				FinishReason *string `json:"finish_reason"`
			} `json:"choices"`
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
			} `json:"usage"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			return nil
		}
		if chunk.Error != nil && chunk.Error.Message != "" {
			return fmt.Errorf("provider error: %s", chunk.Error.Message)
		}
		for _, c := range chunk.Choices {
			if r := c.Delta.ReasoningContent + c.Delta.Reasoning; r != "" {
				if err := emit(Event{Type: EventReasoning, Text: r}); err != nil {
					return err
				}
			}
			if c.Delta.Content != "" {
				if err := emit(Event{Type: EventContent, Text: c.Delta.Content}); err != nil {
					return err
				}
			}
		}
		if chunk.Usage != nil {
			stats.InputTokens = chunk.Usage.PromptTokens
			stats.OutputTokens = chunk.Usage.CompletionTokens
		}
		return nil
	})
	if err != nil {
		return err
	}
	return emit(Event{Type: EventDone, Stats: timedStats(&stats, start)})
}

func (o *OpenAI) post(ctx context.Context, body map[string]any) (*http.Response, error) {
	url := o.base + "/chat/completions"
	if v := optString(o.cfg.Options, "apiVersion", ""); v != "" && strings.Contains(o.base, "openai.azure.com") {
		url += "?api-version=" + v
	}
	return doJSON(ctx, o.client, o.cfg, http.MethodPost, url, body, o.auth)
}
