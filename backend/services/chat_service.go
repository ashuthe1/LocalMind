package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/logger"
	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/providers"
	"github.com/ashuthe1/localmind/store"
	"github.com/ashuthe1/localmind/utils"
)

const defaultTitle = "New Chat"

// Sink receives streaming events destined for the client.
type Sink interface {
	Emit(event string, data any) error
}

// ChatService implements all conversation behaviour.
type ChatService struct {
	store     store.Store
	settings  *SettingsService
	providers *ProviderService
}

func NewChatService(st store.Store, settings *SettingsService, prov *ProviderService) *ChatService {
	return &ChatService{store: st, settings: settings, providers: prov}
}

// ---------- CRUD ----------

func (s *ChatService) List(ctx context.Context, query string) ([]models.ChatSummary, error) {
	return s.store.ListChats(ctx, store.ListOptions{Query: query, IncludeArchived: true})
}

func (s *ChatService) Get(ctx context.Context, id string) (*models.Chat, error) {
	return s.store.GetChat(ctx, id)
}

// CreateInput is the body of POST /api/chats.
type CreateInput struct {
	Title        string `json:"title"`
	ProviderID   string `json:"providerId"`
	Model        string `json:"model"`
	SystemPrompt string `json:"systemPrompt"`
}

func (s *ChatService) Create(ctx context.Context, in CreateInput) (*models.Chat, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = defaultTitle
	}
	chat := &models.Chat{Title: title, ProviderID: in.ProviderID, Model: in.Model, SystemPrompt: in.SystemPrompt, Messages: []models.Message{}, Meta: map[string]string{}}
	if err := s.store.CreateChat(ctx, chat); err != nil {
		return nil, err
	}
	return chat, nil
}

// PatchInput is the body of PATCH /api/chats/{id}.
type PatchInput struct {
	Title        *string `json:"title"`
	Pinned       *bool   `json:"pinned"`
	Archived     *bool   `json:"archived"`
	ProviderID   *string `json:"providerId"`
	Model        *string `json:"model"`
	SystemPrompt *string `json:"systemPrompt"`
}

func (s *ChatService) Patch(ctx context.Context, id string, in PatchInput) (*models.Chat, error) {
	chat, err := s.store.GetChat(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.Title != nil {
		t := strings.TrimSpace(*in.Title)
		if t == "" {
			return nil, validationErr("title cannot be empty")
		}
		chat.Title = t
	}
	if in.Pinned != nil {
		chat.Pinned = *in.Pinned
	}
	if in.Archived != nil {
		chat.Archived = *in.Archived
	}
	if in.ProviderID != nil || in.Model != nil {
		if in.ProviderID != nil && *in.ProviderID != chat.ProviderID {
			chat.Meta = map[string]string{} // provider changed: drop stateful chains
		}
		if in.ProviderID != nil {
			chat.ProviderID = *in.ProviderID
		}
		if in.Model != nil {
			chat.Model = *in.Model
		}
	}
	if in.SystemPrompt != nil {
		chat.SystemPrompt = *in.SystemPrompt
	}
	if err := s.store.UpdateChat(ctx, chat); err != nil {
		return nil, err
	}
	return chat, nil
}

func (s *ChatService) Delete(ctx context.Context, id string) error {
	return s.store.DeleteChat(ctx, id)
}

func (s *ChatService) DeleteAll(ctx context.Context) error { return s.store.DeleteAllChats(ctx) }

// UpdateMessage edits a message; truncateAfter removes everything after it.
func (s *ChatService) UpdateMessage(ctx context.Context, chatID, msgID, content string, truncateAfter bool) (*models.Chat, error) {
	chat, err := s.store.GetChat(ctx, chatID)
	if err != nil {
		return nil, err
	}
	idx := indexOfMessage(chat, msgID)
	if idx < 0 {
		return nil, store.ErrNotFound
	}
	now := utils.NowUTC()
	chat.Messages[idx].Content = content
	chat.Messages[idx].EditedAt = &now
	if truncateAfter {
		chat.Messages = chat.Messages[:idx+1]
	}
	chat.Meta = map[string]string{}
	if err := s.store.UpdateChat(ctx, chat); err != nil {
		return nil, err
	}
	return chat, nil
}

// DeleteMessage removes a message; cascade also removes everything after it.
func (s *ChatService) DeleteMessage(ctx context.Context, chatID, msgID string, cascade bool) (*models.Chat, error) {
	chat, err := s.store.GetChat(ctx, chatID)
	if err != nil {
		return nil, err
	}
	idx := indexOfMessage(chat, msgID)
	if idx < 0 {
		return nil, store.ErrNotFound
	}
	if cascade {
		chat.Messages = chat.Messages[:idx]
	} else {
		chat.Messages = append(chat.Messages[:idx], chat.Messages[idx+1:]...)
	}
	chat.Meta = map[string]string{}
	if err := s.store.UpdateChat(ctx, chat); err != nil {
		return nil, err
	}
	return chat, nil
}

// AppendAssistantMessage adds a canned assistant message (used for the welcome chat).
func (s *ChatService) AppendAssistantMessage(ctx context.Context, chatID, content string) (*models.Chat, error) {
	chat, err := s.store.GetChat(ctx, chatID)
	if err != nil {
		return nil, err
	}
	chat.Messages = append(chat.Messages, models.Message{ID: utils.NewID(), Role: "assistant", Content: content, Timestamp: utils.NowUTC()})
	if err := s.store.UpdateChat(ctx, chat); err != nil {
		return nil, err
	}
	return chat, nil
}

func indexOfMessage(chat *models.Chat, id string) int {
	for i, m := range chat.Messages {
		if m.ID == id {
			return i
		}
	}
	return -1
}

// ---------- sending ----------

// SendInput is the body of POST /api/chat.
type SendInput struct {
	ChatID     string         `json:"chatId"`
	Content    string         `json:"content"`
	Message    string         `json:"message"` // legacy alias for content
	Images     []models.Image `json:"images"`
	ProviderID string         `json:"providerId"`
	Model      string         `json:"model"`
}

// RegenerateInput is the body of POST /api/chats/{id}/regenerate.
type RegenerateInput struct {
	MessageID  string `json:"messageId"`
	ProviderID string `json:"providerId"`
	Model      string `json:"model"`
}

// Send stores the user message and streams the assistant reply.
func (s *ChatService) Send(ctx context.Context, in SendInput, sink Sink) error {
	content := strings.TrimSpace(in.Content)
	if content == "" {
		content = strings.TrimSpace(in.Message)
	}
	if content == "" && len(in.Images) == 0 {
		return validationErr("message content is required")
	}
	for i := range in.Images {
		if in.Images[i].MimeType == "" {
			in.Images[i].MimeType = "image/png"
		}
		in.Images[i].Data = stripDataURL(in.Images[i].Data)
	}

	var chat *models.Chat
	var err error
	if in.ChatID == "" {
		chat, err = s.Create(ctx, CreateInput{ProviderID: in.ProviderID, Model: in.Model})
	} else {
		chat, err = s.store.GetChat(ctx, in.ChatID)
	}
	if err != nil {
		return err
	}

	target, err := s.providers.Resolve(ctx, chat, in.ProviderID, in.Model)
	if err != nil {
		return err
	}
	if in.ProviderID != "" || in.Model != "" {
		if chat.ProviderID != target.Config.ID {
			chat.Meta = map[string]string{}
		}
		chat.ProviderID, chat.Model = target.Config.ID, target.Model
	}

	userMsg := models.Message{ID: utils.NewID(), Role: "user", Content: content, Images: in.Images, Timestamp: utils.NowUTC()}
	chat.Messages = append(chat.Messages, userMsg)
	if err := s.store.UpdateChat(ctx, chat); err != nil {
		return err
	}
	return s.generate(ctx, chat, target, userMsg.ID, sink)
}

// Regenerate replaces an assistant reply.
func (s *ChatService) Regenerate(ctx context.Context, chatID string, in RegenerateInput, sink Sink) error {
	chat, err := s.store.GetChat(ctx, chatID)
	if err != nil {
		return err
	}
	if in.MessageID != "" {
		idx := indexOfMessage(chat, in.MessageID)
		if idx < 0 {
			return store.ErrNotFound
		}
		if chat.Messages[idx].Role == "user" {
			idx++ // regenerate the reply to this user message
		}
		chat.Messages = chat.Messages[:idx]
	}
	for len(chat.Messages) > 0 && chat.Messages[len(chat.Messages)-1].Role == "assistant" {
		chat.Messages = chat.Messages[:len(chat.Messages)-1]
	}
	if len(chat.Messages) == 0 || chat.Messages[len(chat.Messages)-1].Role != "user" {
		return validationErr("there is no user message to reply to")
	}
	target, err := s.providers.Resolve(ctx, chat, in.ProviderID, in.Model)
	if err != nil {
		return err
	}
	if in.ProviderID != "" || in.Model != "" {
		chat.ProviderID, chat.Model = target.Config.ID, target.Model
	}
	chat.Meta = map[string]string{}
	if err := s.store.UpdateChat(ctx, chat); err != nil {
		return err
	}
	return s.generate(ctx, chat, target, "", sink)
}

func stripDataURL(data string) string {
	if i := strings.Index(data, "base64,"); i >= 0 && strings.HasPrefix(data, "data:") {
		return data[i+len("base64,"):]
	}
	return data
}

// generate streams one assistant reply for the chat's current messages and persists it.
func (s *ChatService) generate(ctx context.Context, chat *models.Chat, target *Target, userMessageID string, sink Sink) error {
	settings, err := s.settings.Get(ctx)
	if err != nil {
		return err
	}
	prov, err := s.providers.Build(target.Config)
	if err != nil {
		return err
	}

	assistant := models.Message{
		ID: utils.NewID(), Role: "assistant", Model: target.Model, ProviderID: target.Config.ID, ProviderName: target.Config.Name,
		Timestamp: utils.NowUTC(), Stats: &models.Stats{},
	}
	if err := sink.Emit("meta", map[string]any{
		"chatId": chat.ID, "userMessageId": userMessageID, "assistantMessageId": assistant.ID,
		"model": target.Model, "providerId": target.Config.ID, "providerName": target.Config.Name,
	}); err != nil {
		return err
	}

	req := s.buildRequest(ctx, chat, settings, target)

	var content, reasoning strings.Builder
	splitter := newThinkSplitter(
		func(text string) error {
			content.WriteString(text)
			return sink.Emit("content", map[string]string{"text": text})
		},
		func(text string) error {
			reasoning.WriteString(text)
			return sink.Emit("reasoning", map[string]string{"text": text})
		},
	)
	var doneEvent *providers.Event
	start := time.Now()
	streamErr := prov.Stream(ctx, req, func(ev providers.Event) error {
		switch ev.Type {
		case providers.EventContent:
			return splitter.Write(ev.Text)
		case providers.EventReasoning:
			reasoning.WriteString(ev.Text)
			return sink.Emit("reasoning", map[string]string{"text": ev.Text})
		case providers.EventStatus:
			return sink.Emit("status", map[string]string{"text": ev.Text})
		case providers.EventDone:
			cp := ev
			doneEvent = &cp
		}
		return nil
	})
	if ferr := splitter.Flush(); ferr != nil && streamErr == nil {
		streamErr = ferr
	}

	assistant.Content = strings.TrimSpace(content.String())
	assistant.Reasoning = strings.TrimSpace(reasoning.String())
	if doneEvent != nil && doneEvent.Stats != nil {
		assistant.Stats = doneEvent.Stats
	} else {
		assistant.Stats.DurationMs = time.Since(start).Milliseconds()
	}
	if assistant.Stats.OutputTokens == 0 && assistant.Content != "" {
		// Rough estimate so the UI can still show throughput.
		assistant.Stats.OutputTokens = estimateTokens(assistant.Content + assistant.Reasoning)
		if assistant.Stats.DurationMs > 0 {
			assistant.Stats.TokensPerSecond = float64(assistant.Stats.OutputTokens) / (float64(assistant.Stats.DurationMs) / 1000)
		}
	}

	// Persist using a fresh context: the request context may already be cancelled (stop button).
	saveCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientGone := false
	if streamErr != nil {
		if errors.Is(streamErr, context.Canceled) || ctx.Err() != nil {
			assistant.Stats.Stopped = true
			clientGone = ctx.Err() != nil
		} else {
			assistant.Stats.Error = streamErr.Error()
			logger.Log.Warnf("generation failed (provider=%s model=%s): %v", target.Config.Name, target.Model, streamErr)
			_ = sink.Emit("error", map[string]string{"message": streamErr.Error()})
		}
	}

	if doneEvent != nil && len(doneEvent.Meta) > 0 {
		if chat.Meta == nil {
			chat.Meta = map[string]string{}
		}
		for k, v := range doneEvent.Meta {
			chat.Meta[k] = v
		}
	}
	chat.Messages = append(chat.Messages, assistant)
	if err := s.store.UpdateChat(saveCtx, chat); err != nil {
		logger.Log.Errorf("saving assistant message: %v", err)
	}
	if clientGone {
		return nil
	}
	if err := sink.Emit("done", map[string]any{"message": assistant, "chat": chat.Summary()}); err != nil {
		return nil
	}

	if settings.Features.AutoTitle && (chat.Title == defaultTitle || chat.Title == "") && assistant.Content != "" && assistant.Stats.Error == "" {
		if title := s.generateTitle(ctx, prov, target, chat); title != "" {
			titleCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if fresh, err := s.store.GetChat(titleCtx, chat.ID); err == nil && (fresh.Title == defaultTitle || fresh.Title == "") {
				fresh.Title = title
				if err := s.store.UpdateChat(titleCtx, fresh); err == nil {
					_ = sink.Emit("title", map[string]string{"chatId": chat.ID, "title": title})
				}
			}
		}
	}
	return nil
}

// buildRequest assembles the provider request from settings, profile and history.
func (s *ChatService) buildRequest(ctx context.Context, chat *models.Chat, settings *models.Settings, target *Target) providers.Request {
	system := strings.TrimSpace(chat.SystemPrompt)
	if system == "" {
		system = strings.TrimSpace(settings.SystemPrompt)
	}
	if name := strings.TrimSpace(settings.Assistant.Name); name != "" {
		system = strings.TrimSpace(system + "\n\nYour name is " + name + ".")
	}
	if settings.Features.SendUserProfile {
		if user, err := s.settings.GetUser(ctx); err == nil {
			var parts []string
			if user.Username != "" {
				parts = append(parts, "The user's name is "+user.Username+".")
			}
			if strings.TrimSpace(user.AboutMe) != "" {
				parts = append(parts, "About the user: "+strings.TrimSpace(user.AboutMe))
			}
			if strings.TrimSpace(user.Preferences) != "" {
				parts = append(parts, "The user's preferences for how you should respond: "+strings.TrimSpace(user.Preferences))
			}
			if len(parts) > 0 {
				system = strings.TrimSpace(system + "\n\n" + strings.Join(parts, "\n"))
			}
		}
	}

	history := chat.Messages
	if limit := settings.Features.HistoryLimit; limit > 0 && len(history) > limit {
		history = history[len(history)-limit:]
		// Never start the window with an assistant turn.
		for len(history) > 0 && history[0].Role != "user" {
			history = history[1:]
		}
	}
	msgs := make([]providers.Message, 0, len(history))
	for _, m := range history {
		if m.Role == "system" || (strings.TrimSpace(m.Content) == "" && len(m.Images) == 0) {
			continue
		}
		pm := providers.Message{Role: m.Role, Content: m.Content}
		for _, img := range m.Images {
			pm.Images = append(pm.Images, providers.Image{MimeType: img.MimeType, Data: img.Data})
		}
		msgs = append(msgs, pm)
	}
	meta := map[string]string{}
	for k, v := range chat.Meta {
		meta[k] = v
	}
	return providers.Request{Model: target.Model, System: system, Messages: msgs, Params: settings.Generation, Meta: meta}
}

// generateTitle asks the model for a short title. Failures are silent.
func (s *ChatService) generateTitle(ctx context.Context, prov providers.Provider, target *Target, chat *models.Chat) string {
	var userText, assistantText string
	for _, m := range chat.Messages {
		if m.Role == "user" && userText == "" {
			userText = m.Content
		}
		if m.Role == "assistant" && assistantText == "" {
			assistantText = m.Content
		}
	}
	if userText == "" {
		return ""
	}
	prompt := fmt.Sprintf("Write a short title (3 to 6 words, no quotes, no trailing punctuation) for a conversation that begins:\n\nUser: %s\n\nAssistant: %s\n\nReply with the title only.", truncateRunes(userText, 600), truncateRunes(assistantText, 400))
	tctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	off := "off"
	req := providers.Request{Model: target.Model, Messages: []providers.Message{{Role: "user", Content: prompt}}, Params: models.GenerationParams{Reasoning: off, MaxTokens: utils.Ptr(40), Temperature: utils.Ptr(0.3)}, Meta: map[string]string{}}
	var out strings.Builder
	err := prov.Stream(tctx, req, func(ev providers.Event) error {
		if ev.Type == providers.EventContent {
			out.WriteString(ev.Text)
		}
		return nil
	})
	if err != nil {
		logger.Log.Debugf("title generation failed: %v", err)
		return ""
	}
	return cleanTitle(out.String())
}

func cleanTitle(raw string) string {
	t := raw
	if i := strings.Index(t, "</think>"); i >= 0 {
		t = t[i+len("</think>"):]
	}
	t = strings.ReplaceAll(t, "<think>", "")
	t = strings.TrimSpace(t)
	if i := strings.IndexAny(t, "\n"); i >= 0 {
		t = strings.TrimSpace(t[:i])
	}
	t = strings.Trim(t, "\"'“”‘’*#` ")
	t = strings.TrimPrefix(t, "Title:")
	t = strings.TrimSpace(strings.TrimSuffix(t, "."))
	if len([]rune(t)) > 60 {
		t = truncateRunes(t, 57) + "…"
	}
	if t == "" || strings.EqualFold(t, defaultTitle) {
		return ""
	}
	return t
}

func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func estimateTokens(s string) int {
	return (len(s) + 3) / 4
}

// ---------- export / import ----------

// ExportMarkdown renders a chat as Markdown.
func (s *ChatService) ExportMarkdown(ctx context.Context, id string, assistantName string) (string, string, error) {
	chat, err := s.store.GetChat(ctx, id)
	if err != nil {
		return "", "", err
	}
	user, _ := s.settings.GetUser(ctx)
	userName := "You"
	if user != nil && user.Username != "" {
		userName = user.Username
	}
	if assistantName == "" {
		assistantName = "Assistant"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\n_Exported from LocalMind on %s_\n\n", chat.Title, time.Now().Format("2006-01-02 15:04"))
	for _, m := range chat.Messages {
		name := assistantName
		if m.Role == "user" {
			name = userName
		}
		fmt.Fprintf(&b, "## %s — %s\n\n", name, m.Timestamp.Local().Format("Jan 2, 2006 15:04"))
		if m.Reasoning != "" {
			fmt.Fprintf(&b, "<details><summary>Thinking</summary>\n\n%s\n\n</details>\n\n", m.Reasoning)
		}
		for _, img := range m.Images {
			fmt.Fprintf(&b, "![%s](%s)\n\n", img.Name, img.DataURL())
		}
		b.WriteString(m.Content)
		b.WriteString("\n\n")
		if m.Model != "" {
			fmt.Fprintf(&b, "_%s · %s_\n\n", m.ProviderName, m.Model)
		}
		b.WriteString("---\n\n")
	}
	return b.String(), safeFilename(chat.Title) + ".md", nil
}

// ExportJSON renders a chat as JSON.
func (s *ChatService) ExportJSON(ctx context.Context, id string) ([]byte, string, error) {
	chat, err := s.store.GetChat(ctx, id)
	if err != nil {
		return nil, "", err
	}
	b, err := json.MarshalIndent(chat, "", "  ")
	return b, safeFilename(chat.Title) + ".json", err
}

func safeFilename(s string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(s) {
		switch {
		case r == ' ':
			b.WriteRune('-')
		case strings.ContainsRune(`/\:*?"<>|`, r):
		default:
			b.WriteRune(r)
		}
	}
	out := strings.Trim(b.String(), "-.")
	if out == "" {
		out = "chat"
	}
	return truncateRunes(out, 80)
}

// Backup is the all-data export format.
type Backup struct {
	Version    string           `json:"version"`
	ExportedAt time.Time        `json:"exportedAt"`
	User       *models.User     `json:"user"`
	Settings   *models.Settings `json:"settings"`
	Chats      []models.Chat    `json:"chats"`
}

func (s *ChatService) ExportAll(ctx context.Context, version string) (*Backup, error) {
	summaries, err := s.store.ListChats(ctx, store.ListOptions{IncludeArchived: true})
	if err != nil {
		return nil, err
	}
	chats := make([]models.Chat, 0, len(summaries))
	for _, sum := range summaries {
		chat, err := s.store.GetChat(ctx, sum.ID)
		if err != nil {
			return nil, err
		}
		chats = append(chats, *chat)
	}
	settings, err := s.settings.Get(ctx)
	if err != nil {
		return nil, err
	}
	masked := settings.Masked()
	user, _ := s.settings.GetUser(ctx)
	return &Backup{Version: version, ExportedAt: utils.NowUTC(), User: user, Settings: &masked, Chats: chats}, nil
}

// ImportAll merges a backup. Returns the number of chats imported.
func (s *ChatService) ImportAll(ctx context.Context, b *Backup) (int, error) {
	count := 0
	for i := range b.Chats {
		chat := b.Chats[i]
		if chat.Title == "" {
			chat.Title = defaultTitle
		}
		if chat.Messages == nil {
			chat.Messages = []models.Message{}
		}
		if chat.Meta == nil {
			chat.Meta = map[string]string{}
		}
		if chat.ID != "" {
			if _, err := s.store.GetChat(ctx, chat.ID); err == nil {
				if err := s.store.UpdateChat(ctx, &chat); err != nil {
					return count, err
				}
				count++
				continue
			}
		}
		if err := s.store.CreateChat(ctx, &chat); err != nil {
			return count, err
		}
		count++
	}
	if b.User != nil {
		if err := s.settings.ReplaceUser(ctx, b.User); err != nil {
			return count, err
		}
	}
	if b.Settings != nil {
		patch := map[string]json.RawMessage{}
		for k, v := range map[string]any{
			"systemPrompt": b.Settings.SystemPrompt, "assistant": b.Settings.Assistant,
			"generation": b.Settings.Generation, "features": b.Settings.Features, "appearance": b.Settings.Appearance,
		} {
			raw, _ := json.Marshal(v)
			patch[k] = raw
		}
		if _, err := s.settings.Update(ctx, patch); err != nil {
			return count, err
		}
	}
	return count, nil
}
