// Package models holds the data types shared by the store, services and API.
package models

import "time"

// Image is an image attachment on a message. Data is base64 without the data: URL prefix.
type Image struct {
	Name     string `json:"name"`
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

// DataURL renders the image as a data: URL.
func (i Image) DataURL() string {
	mime := i.MimeType
	if mime == "" {
		mime = "image/png"
	}
	return "data:" + mime + ";base64," + i.Data
}

// Stats describes how an assistant message was generated.
type Stats struct {
	InputTokens     int     `json:"inputTokens"`
	OutputTokens    int     `json:"outputTokens"`
	DurationMs      int64   `json:"durationMs"`
	TokensPerSecond float64 `json:"tokensPerSecond"`
	Stopped         bool    `json:"stopped"`
	Error           string  `json:"error,omitempty"`
}

// Message is a single turn in a chat.
type Message struct {
	ID           string     `json:"id"`
	Role         string     `json:"role"` // user | assistant | system
	Content      string     `json:"content"`
	Reasoning    string     `json:"reasoning,omitempty"`
	Images       []Image    `json:"images,omitempty"`
	Model        string     `json:"model,omitempty"`
	ProviderID   string     `json:"providerId,omitempty"`
	ProviderName string     `json:"providerName,omitempty"`
	Timestamp    time.Time  `json:"timestamp"`
	EditedAt     *time.Time `json:"editedAt"`
	Stats        *Stats     `json:"stats,omitempty"`
}

// Chat is a conversation.
type Chat struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Pinned       bool              `json:"pinned"`
	Archived     bool              `json:"archived"`
	ProviderID   string            `json:"providerId"`
	Model        string            `json:"model"`
	SystemPrompt string            `json:"systemPrompt"`
	Meta         map[string]string `json:"-"`
	Messages     []Message         `json:"messages"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

// ChatSummary is the list representation of a chat.
type ChatSummary struct {
	ID                 string     `json:"id"`
	Title              string     `json:"title"`
	Pinned             bool       `json:"pinned"`
	Archived           bool       `json:"archived"`
	ProviderID         string     `json:"providerId"`
	Model              string     `json:"model"`
	MessageCount       int        `json:"messageCount"`
	LastMessagePreview string     `json:"lastMessagePreview"`
	LastMessageAt      *time.Time `json:"lastMessageAt"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

// Summary builds the list representation of a chat.
func (c *Chat) Summary() ChatSummary {
	s := ChatSummary{
		ID: c.ID, Title: c.Title, Pinned: c.Pinned, Archived: c.Archived,
		ProviderID: c.ProviderID, Model: c.Model, MessageCount: len(c.Messages),
		CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt,
	}
	if n := len(c.Messages); n > 0 {
		last := c.Messages[n-1]
		preview := []rune(last.Content)
		if len(preview) > 120 {
			preview = append(preview[:120], '…')
		}
		s.LastMessagePreview = string(preview)
		t := last.Timestamp
		s.LastMessageAt = &t
	}
	return s
}

// User is the single local profile.
type User struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	AboutMe     string    `json:"aboutMe"`
	Preferences string    `json:"preferences"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ProviderConfig is a configured LLM endpoint.
type ProviderConfig struct {
	ID           string            `json:"id"`
	Type         string            `json:"type"`
	Name         string            `json:"name"`
	BaseURL      string            `json:"baseUrl"`
	APIKey       string            `json:"apiKey,omitempty"`
	APIKeySet    bool              `json:"apiKeySet"`
	ClearAPIKey  bool              `json:"clearApiKey,omitempty"`
	Headers      map[string]string `json:"headers"`
	DefaultModel string            `json:"defaultModel"`
	Models       []string          `json:"models"`
	Enabled      bool              `json:"enabled"`
	Options      map[string]any    `json:"options"`
}

// Masked returns a copy safe to send to clients.
func (p ProviderConfig) Masked() ProviderConfig {
	p.APIKeySet = p.APIKey != ""
	p.APIKey = ""
	p.ClearAPIKey = false
	if p.Headers == nil {
		p.Headers = map[string]string{}
	}
	if p.Models == nil {
		p.Models = []string{}
	}
	if p.Options == nil {
		p.Options = map[string]any{}
	}
	return p
}

// GenerationParams are sampling settings. Nil pointers mean "provider default".
type GenerationParams struct {
	Temperature   *float64 `json:"temperature"`
	TopP          *float64 `json:"topP"`
	MaxTokens     *int     `json:"maxTokens"`
	ContextLength *int     `json:"contextLength"`
	Reasoning     string   `json:"reasoning"` // auto | off | low | medium | high | on
	Seed          *int     `json:"seed"`
	StopSequences []string `json:"stopSequences"`
}

// AssistantPersona names the bot.
type AssistantPersona struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
}

// Features toggles backend behaviour.
type Features struct {
	AutoTitle       bool `json:"autoTitle"`
	HistoryLimit    int  `json:"historyLimit"`
	SendUserProfile bool `json:"sendUserProfile"`
}

// Settings is the single app-wide settings document.
type Settings struct {
	ActiveProviderID string           `json:"activeProviderId"`
	ActiveModel      string           `json:"activeModel"`
	SystemPrompt     string           `json:"systemPrompt"`
	Assistant        AssistantPersona `json:"assistant"`
	Generation       GenerationParams `json:"generation"`
	Features         Features         `json:"features"`
	Appearance       map[string]any   `json:"appearance"`
	Providers        []ProviderConfig `json:"providers"`
	UpdatedAt        time.Time        `json:"updatedAt"`
}

// DefaultSettings returns the settings used on first run.
func DefaultSettings() *Settings {
	return &Settings{
		SystemPrompt: "You are a helpful, knowledgeable assistant. Answer clearly and concisely, using Markdown when it helps.",
		Assistant:    AssistantPersona{Name: "Smriti", Avatar: "✨"},
		Generation:   GenerationParams{Reasoning: "auto", StopSequences: []string{}},
		Features:     Features{AutoTitle: true, HistoryLimit: 40, SendUserProfile: true},
		Appearance: map[string]any{
			"theme": "system", "accent": "#3f51b5", "fontSize": "medium", "codeTheme": "material",
			"showReasoning": true, "showTimestamps": true, "sendOnEnter": true, "compact": false,
		},
		Providers: []ProviderConfig{},
	}
}

// Normalize fills nil collections so JSON output is stable.
func (s *Settings) Normalize() {
	if s.Appearance == nil {
		s.Appearance = map[string]any{}
	}
	if s.Providers == nil {
		s.Providers = []ProviderConfig{}
	}
	if s.Generation.StopSequences == nil {
		s.Generation.StopSequences = []string{}
	}
	if s.Generation.Reasoning == "" {
		s.Generation.Reasoning = "auto"
	}
}

// Masked returns a copy with provider secrets removed.
func (s Settings) Masked() Settings {
	out := s
	out.Providers = make([]ProviderConfig, len(s.Providers))
	for i, p := range s.Providers {
		out.Providers[i] = p.Masked()
	}
	return out
}

// FindProvider returns the provider with the given id, or nil.
func (s *Settings) FindProvider(id string) *ProviderConfig {
	for i := range s.Providers {
		if s.Providers[i].ID == id {
			return &s.Providers[i]
		}
	}
	return nil
}
