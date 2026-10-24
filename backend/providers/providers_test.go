package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ashuthe1/localmind/models"
)

func collect(t *testing.T, p Provider, req Request) (content, reasoning string, done *Event) {
	t.Helper()
	err := p.Stream(context.Background(), req, func(ev Event) error {
		switch ev.Type {
		case EventContent:
			content += ev.Text
		case EventReasoning:
			reasoning += ev.Text
		case EventDone:
			cp := ev
			done = &cp
		}
		return nil
	})
	if err != nil {
		t.Fatalf("stream: %v", err)
	}
	return
}

func TestLMStudioInputUsesTextType(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/chat" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "event: reasoning.delta\ndata: {\"type\":\"reasoning.delta\",\"content\":\"hmm\"}\n\n")
		fmt.Fprint(w, "event: message.delta\ndata: {\"type\":\"message.delta\",\"content\":\"a cat\"}\n\n")
		fmt.Fprint(w, "event: chat.end\ndata: {\"type\":\"chat.end\",\"result\":{\"response_id\":\"resp_1\",\"stats\":{\"input_tokens\":3,\"total_output_tokens\":2}}}\n\n")
	}))
	defer srv.Close()

	p, err := New(models.ProviderConfig{Type: "lmstudio", BaseURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	content, reasoning, done := collect(t, p, Request{
		Model:    "m",
		System:   "be brief",
		Messages: []Message{{Role: "user", Content: "what's in this image", Images: []Image{{MimeType: "image/png", Data: "AAAA"}}}},
		Meta:     map[string]string{},
	})
	if content != "a cat" || reasoning != "hmm" {
		t.Fatalf("content=%q reasoning=%q", content, reasoning)
	}
	if done == nil || done.Meta[lmMetaResponseID] != "resp_1" || done.Stats.InputTokens != 3 {
		t.Fatalf("done event wrong: %+v", done)
	}
	input, _ := got["input"].([]any)
	if len(input) != 2 {
		t.Fatalf("expected 2 input items, got %v", got["input"])
	}
	text := input[0].(map[string]any)
	if text["type"] != "text" || text["content"] != "what's in this image" {
		t.Fatalf("text item must be {type:text, content:...}; got %v", text) // GitHub issue #6
	}
	img := input[1].(map[string]any)
	if img["type"] != "image" || !strings.HasPrefix(img["data_url"].(string), "data:image/png;base64,") {
		t.Fatalf("image item wrong: %v", img)
	}
	if got["system_prompt"] != "be brief" || got["stream"] != true {
		t.Fatalf("system_prompt/stream missing: %v", got)
	}
}

func TestLMStudioContinuesChain(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = map[string]any{}
		_ = json.NewDecoder(r.Body).Decode(&got)
		fmt.Fprint(w, "event: chat.end\ndata: {\"type\":\"chat.end\",\"result\":{\"response_id\":\"resp_2\"}}\n\n")
	}))
	defer srv.Close()
	p, _ := New(models.ProviderConfig{Type: "lmstudio", BaseURL: srv.URL})
	history := []Message{{Role: "user", Content: "one"}, {Role: "assistant", Content: "two"}, {Role: "user", Content: "three"}}
	_, _, done := collect(t, p, Request{Model: "m", Messages: history, Meta: map[string]string{lmMetaResponseID: "resp_1", lmMetaTurnCount: "1"}})
	if got["previous_response_id"] != "resp_1" {
		t.Fatalf("expected chain continuation, got %v", got)
	}
	if done.Meta[lmMetaTurnCount] != "2" {
		t.Fatalf("turn count not advanced: %v", done.Meta)
	}
	// Stale chain (turn count mismatch) falls back to the transcript.
	_, _, _ = collect(t, p, Request{Model: "m", Messages: history, Meta: map[string]string{lmMetaResponseID: "resp_1", lmMetaTurnCount: "5"}})
	if _, ok := got["previous_response_id"]; ok {
		t.Fatalf("stale chain should not be reused")
	}
	if !strings.Contains(got["input"].([]any)[0].(map[string]any)["content"].(string), "Assistant: two") {
		t.Fatalf("transcript fallback missing history")
	}
}

func TestOpenAIStreamAndImages(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/models":
			fmt.Fprint(w, `{"data":[{"id":"gpt-4o"},{"id":"plain"}]}`)
		case "/v1/chat/completions":
			if r.Header.Get("Authorization") != "Bearer k" {
				w.WriteHeader(401)
				fmt.Fprint(w, `{"error":{"message":"bad key"}}`)
				return
			}
			_ = json.NewDecoder(r.Body).Decode(&got)
			fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"r1\"}}]}\n\n")
			fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Hel\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n")
			fmt.Fprint(w, "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":7,\"completion_tokens\":2}}\n\ndata: [DONE]\n\n")
		}
	}))
	defer srv.Close()
	p, _ := New(models.ProviderConfig{Type: "openai", BaseURL: srv.URL + "/v1", APIKey: "k"})
	list, err := p.ListModels(context.Background())
	if err != nil || len(list) != 2 || !list[0].Vision || list[1].Vision {
		t.Fatalf("models: %v %v", list, err)
	}
	temp := 0.5
	content, reasoning, done := collect(t, p, Request{Model: "gpt-4o", System: "sys", Params: models.GenerationParams{Temperature: &temp, Reasoning: "low"},
		Messages: []Message{{Role: "user", Content: "hi", Images: []Image{{MimeType: "image/jpeg", Data: "QUJD"}}}}})
	if content != "Hello" || reasoning != "r1" || done.Stats.InputTokens != 7 || done.Stats.OutputTokens != 2 {
		t.Fatalf("content=%q reasoning=%q stats=%+v", content, reasoning, done.Stats)
	}
	msgs := got["messages"].([]any)
	if msgs[0].(map[string]any)["role"] != "system" {
		t.Fatalf("system message missing")
	}
	parts := msgs[1].(map[string]any)["content"].([]any)
	if parts[1].(map[string]any)["type"] != "image_url" {
		t.Fatalf("image part missing: %v", parts)
	}
	if got["reasoning_effort"] != "low" || got["temperature"] != 0.5 {
		t.Fatalf("params not forwarded: %v", got)
	}

	bad, _ := New(models.ProviderConfig{Type: "openai", BaseURL: srv.URL + "/v1", APIKey: "wrong"})
	err = bad.Stream(context.Background(), Request{Model: "x", Messages: []Message{{Role: "user", Content: "hi"}}}, func(Event) error { return nil })
	if err == nil || !strings.Contains(err.Error(), "401") || !strings.Contains(err.Error(), "bad key") {
		t.Fatalf("expected friendly 401 error, got %v", err)
	}
}

func TestOllamaStream(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			fmt.Fprint(w, `{"models":[{"name":"llava:latest","model":"llava:latest","details":{"families":["llama","clip"]}}]}`)
		case "/api/chat":
			_ = json.NewDecoder(r.Body).Decode(&got)
			fmt.Fprint(w, `{"message":{"role":"assistant","content":"","thinking":"t"},"done":false}`+"\n")
			fmt.Fprint(w, `{"message":{"role":"assistant","content":"Hi"},"done":false}`+"\n")
			fmt.Fprint(w, `{"message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":4,"eval_count":1}`+"\n")
		}
	}))
	defer srv.Close()
	p, _ := New(models.ProviderConfig{Type: "ollama", BaseURL: srv.URL})
	list, err := p.ListModels(context.Background())
	if err != nil || len(list) != 1 || !list[0].Vision {
		t.Fatalf("models: %v %v", list, err)
	}
	n := 128
	content, reasoning, done := collect(t, p, Request{Model: "llava", Params: models.GenerationParams{MaxTokens: &n, Reasoning: "off"},
		Messages: []Message{{Role: "user", Content: "hi", Images: []Image{{MimeType: "image/png", Data: "QUJD"}}}}})
	if content != "Hi" || reasoning != "t" || done.Stats.InputTokens != 4 {
		t.Fatalf("content=%q reasoning=%q stats=%+v", content, reasoning, done.Stats)
	}
	if got["think"] != false || got["options"].(map[string]any)["num_predict"] != float64(128) {
		t.Fatalf("options not forwarded: %v", got)
	}
	imgs := got["messages"].([]any)[0].(map[string]any)["images"].([]any)
	if len(imgs) != 1 || imgs[0] != "QUJD" {
		t.Fatalf("images not forwarded: %v", imgs)
	}
}

func TestAnthropicAndGeminiShapes(t *testing.T) {
	var aGot, gGot map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/v1/messages":
			if r.Header.Get("x-api-key") != "ak" {
				w.WriteHeader(401)
				return
			}
			_ = json.NewDecoder(r.Body).Decode(&aGot)
			fmt.Fprint(w, "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":9}}}\n\n")
			fmt.Fprint(w, "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"th\"}}\n\n")
			fmt.Fprint(w, "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"ok\"}}\n\n")
			fmt.Fprint(w, "event: message_delta\ndata: {\"type\":\"message_delta\",\"usage\":{\"output_tokens\":1}}\n\n")
		case strings.Contains(r.URL.Path, ":streamGenerateContent"):
			if r.Header.Get("x-goog-api-key") != "gk" || r.URL.Query().Get("alt") != "sse" {
				w.WriteHeader(401)
				return
			}
			_ = json.NewDecoder(r.Body).Decode(&gGot)
			fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"think\",\"thought\":true},{\"text\":\"yes\"}]}}],\"usageMetadata\":{\"promptTokenCount\":2,\"candidatesTokenCount\":1}}\n\n")
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	a, _ := New(models.ProviderConfig{Type: "anthropic", BaseURL: srv.URL, APIKey: "ak"})
	content, reasoning, done := collect(t, a, Request{Model: "claude", System: "s", Params: models.GenerationParams{Reasoning: "low"},
		Messages: []Message{{Role: "assistant", Content: "lead"}, {Role: "user", Content: "a"}, {Role: "user", Content: "b", Images: []Image{{MimeType: "image/png", Data: "QUJD"}}}}})
	if content != "ok" || reasoning != "th" || done.Stats.InputTokens != 9 || done.Stats.OutputTokens != 1 {
		t.Fatalf("anthropic content=%q reasoning=%q stats=%+v", content, reasoning, done.Stats)
	}
	msgs := aGot["messages"].([]any)
	if msgs[0].(map[string]any)["role"] != "user" || len(msgs) != 3 {
		t.Fatalf("anthropic messages must alternate starting with user: %v", msgs)
	}
	if aGot["system"] != "s" || aGot["thinking"] == nil {
		t.Fatalf("anthropic system/thinking missing: %v", aGot)
	}

	g, _ := New(models.ProviderConfig{Type: "gemini", BaseURL: srv.URL, APIKey: "gk"})
	content, reasoning, done = collect(t, g, Request{Model: "gemini-2.5-flash", System: "s", Messages: []Message{{Role: "user", Content: "q", Images: []Image{{MimeType: "image/png", Data: "QUJD"}}}, {Role: "assistant", Content: "r"}, {Role: "user", Content: "q2"}}})
	if content != "yes" || reasoning != "think" || done.Stats.InputTokens != 2 {
		t.Fatalf("gemini content=%q reasoning=%q stats=%+v", content, reasoning, done.Stats)
	}
	contents := gGot["contents"].([]any)
	if contents[1].(map[string]any)["role"] != "model" {
		t.Fatalf("gemini assistant role must be model: %v", contents)
	}
	if gGot["systemInstruction"] == nil {
		t.Fatalf("gemini system instruction missing")
	}
	parts := contents[0].(map[string]any)["parts"].([]any)
	if parts[1].(map[string]any)["inline_data"] == nil {
		t.Fatalf("gemini inline image missing: %v", parts)
	}
}
