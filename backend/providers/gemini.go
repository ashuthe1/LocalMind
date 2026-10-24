package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/models"
)

// Gemini talks to the Google Generative Language API.
type Gemini struct {
	base   string
	cfg    models.ProviderConfig
	client *http.Client
}

func (g *Gemini) Type() string { return "gemini" }

func (g *Gemini) auth(req *http.Request) {
	req.Header.Set("x-goog-api-key", g.cfg.APIKey)
}

func (g *Gemini) ListModels(ctx context.Context) ([]ModelInfo, error) {
	if g.cfg.APIKey == "" {
		return nil, errors.New("an API key is required")
	}
	resp, err := doJSON(ctx, g.client, g.cfg, http.MethodGet, g.base+"/models?pageSize=200", nil, g.auth)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var payload struct {
		Models []struct {
			Name                       string   `json:"name"`
			DisplayName                string   `json:"displayName"`
			InputTokenLimit            int      `json:"inputTokenLimit"`
			SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decoding model list: %w", err)
	}
	out := []ModelInfo{}
	for _, m := range payload.Models {
		supported := false
		for _, method := range m.SupportedGenerationMethods {
			if method == "generateContent" {
				supported = true
			}
		}
		if !supported {
			continue
		}
		id := strings.TrimPrefix(m.Name, "models/")
		out = append(out, ModelInfo{ID: id, Name: m.DisplayName, Vision: true, ContextLength: m.InputTokenLimit})
	}
	return out, nil
}

func (g *Gemini) Stream(ctx context.Context, req Request, emit func(Event) error) error {
	if g.cfg.APIKey == "" {
		return errors.New("an API key is required")
	}
	contents := make([]map[string]any, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		parts := []map[string]any{}
		if m.Content != "" {
			parts = append(parts, map[string]any{"text": m.Content})
		}
		for _, img := range m.Images {
			parts = append(parts, map[string]any{"inline_data": map[string]any{"mime_type": img.MimeType, "data": img.Data}})
		}
		if len(parts) == 0 {
			parts = append(parts, map[string]any{"text": " "})
		}
		contents = append(contents, map[string]any{"role": role, "parts": parts})
	}

	genCfg := map[string]any{}
	if req.Params.Temperature != nil {
		genCfg["temperature"] = *req.Params.Temperature
	}
	if req.Params.TopP != nil {
		genCfg["topP"] = *req.Params.TopP
	}
	if req.Params.MaxTokens != nil {
		genCfg["maxOutputTokens"] = *req.Params.MaxTokens
	}
	if req.Params.Seed != nil {
		genCfg["seed"] = *req.Params.Seed
	}
	if len(req.Params.StopSequences) > 0 {
		genCfg["stopSequences"] = req.Params.StopSequences
	}
	if t := reasoningEnabled(req.Params.Reasoning); t != nil {
		thinking := map[string]any{"includeThoughts": *t}
		if !*t {
			thinking["thinkingBudget"] = 0
		} else {
			switch req.Params.Reasoning {
			case "low":
				thinking["thinkingBudget"] = 1024
			case "medium":
				thinking["thinkingBudget"] = 8192
			case "high":
				thinking["thinkingBudget"] = 24576
			}
		}
		genCfg["thinkingConfig"] = thinking
	}

	body := map[string]any{"contents": contents}
	if len(genCfg) > 0 {
		body["generationConfig"] = genCfg
	}
	if req.System != "" {
		body["systemInstruction"] = map[string]any{"parts": []map[string]any{{"text": req.System}}}
	}

	url := fmt.Sprintf("%s/models/%s:streamGenerateContent?alt=sse", g.base, req.Model)
	start := time.Now()
	resp, err := doJSON(ctx, g.client, g.cfg, http.MethodPost, url, body, g.auth)
	if err != nil {
		// Older models reject thinkingConfig; retry without it.
		if he, ok := err.(*HTTPError); ok && he.Status == 400 && genCfg["thinkingConfig"] != nil {
			delete(genCfg, "thinkingConfig")
			if resp, err = doJSON(ctx, g.client, g.cfg, http.MethodPost, url, body, g.auth); err != nil {
				return err
			}
		} else {
			return err
		}
	}
	defer resp.Body.Close()

	var stats models.Stats
	err = readSSE(resp.Body, func(_ string, data string) error {
		if data == "" {
			return nil
		}
		var chunk struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text    string `json:"text"`
						Thought bool   `json:"thought"`
					} `json:"parts"`
				} `json:"content"`
				FinishReason string `json:"finishReason"`
			} `json:"candidates"`
			UsageMetadata *struct {
				PromptTokenCount     int `json:"promptTokenCount"`
				CandidatesTokenCount int `json:"candidatesTokenCount"`
				ThoughtsTokenCount   int `json:"thoughtsTokenCount"`
			} `json:"usageMetadata"`
			PromptFeedback *struct {
				BlockReason string `json:"blockReason"`
			} `json:"promptFeedback"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			return nil
		}
		if chunk.Error != nil {
			return fmt.Errorf("gemini: %s", chunk.Error.Message)
		}
		if chunk.PromptFeedback != nil && chunk.PromptFeedback.BlockReason != "" {
			return fmt.Errorf("gemini blocked the prompt: %s", chunk.PromptFeedback.BlockReason)
		}
		for _, c := range chunk.Candidates {
			for _, p := range c.Content.Parts {
				if p.Text == "" {
					continue
				}
				t := EventContent
				if p.Thought {
					t = EventReasoning
				}
				if err := emit(Event{Type: t, Text: p.Text}); err != nil {
					return err
				}
			}
		}
		if chunk.UsageMetadata != nil {
			stats.InputTokens = chunk.UsageMetadata.PromptTokenCount
			stats.OutputTokens = chunk.UsageMetadata.CandidatesTokenCount + chunk.UsageMetadata.ThoughtsTokenCount
		}
		return nil
	})
	if err != nil {
		return err
	}
	return emit(Event{Type: EventDone, Stats: timedStats(&stats, start)})
}
