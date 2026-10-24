// Package api exposes the HTTP API described in docs/API.md.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/logger"
	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/providers"
	"github.com/ashuthe1/localmind/services"
	"github.com/ashuthe1/localmind/store"
	"github.com/gorilla/mux"
)

const maxBodyBytes = 64 << 20 // images are inlined as base64

// Handler holds the service dependencies.
type Handler struct {
	Chats     *services.ChatService
	Settings  *services.SettingsService
	Providers *services.ProviderService
	Storage   string
	started   time.Time
}

func NewHandler(chats *services.ChatService, settings *services.SettingsService, prov *services.ProviderService, storageName string) *Handler {
	return &Handler{Chats: chats, Settings: settings, Providers: prov, Storage: storageName, started: time.Now()}
}

// ---------- helpers ----------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// writeServiceError maps service/store errors to HTTP statuses.
func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, services.ErrValidation):
		writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), services.ErrValidation.Error()+": "))
	case errors.Is(err, services.ErrNoProvider):
		writeError(w, http.StatusPreconditionFailed, err.Error())
	default:
		logger.Log.Errorf("request failed: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
	}
}

func decode(r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	return nil
}

// ---------- health ----------

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	resp := map[string]any{
		"status":         "ok",
		"version":        config.Version,
		"storage":        h.Storage,
		"uptimeSeconds":  int(time.Since(h.started).Seconds()),
		"activeProvider": nil,
	}
	if settings, err := h.Settings.Get(r.Context()); err == nil && settings.ActiveProviderID != "" {
		if p := settings.FindProvider(settings.ActiveProviderID); p != nil {
			model := settings.ActiveModel
			if model == "" {
				model = p.DefaultModel
			}
			resp["activeProvider"] = map[string]string{"id": p.ID, "name": p.Name, "type": p.Type, "model": model}
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

// ---------- settings ----------

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.Settings.Get(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, settings.Masked())
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var patch map[string]json.RawMessage
	if err := decode(r, &patch); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	settings, err := h.Settings.Update(r.Context(), patch)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, settings.Masked())
}

// ---------- providers ----------

func (h *Handler) ProviderCatalog(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"types": providers.Types(), "presets": providers.Presets()})
}

func (h *Handler) ListProviders(w http.ResponseWriter, r *http.Request) {
	settings, err := h.Settings.Get(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, settings.Masked().Providers)
}

func (h *Handler) CreateProvider(w http.ResponseWriter, r *http.Request) {
	var cfg models.ProviderConfig
	if err := decode(r, &cfg); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	created, err := h.Settings.AddProvider(r.Context(), cfg)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created.Masked())
}

func (h *Handler) UpdateProvider(w http.ResponseWriter, r *http.Request) {
	var raw map[string]json.RawMessage
	if err := decode(r, &raw); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var cfg models.ProviderConfig
	body, _ := json.Marshal(raw)
	if err := json.Unmarshal(body, &cfg); err != nil {
		writeError(w, http.StatusBadRequest, "invalid provider payload: "+err.Error())
		return
	}
	_, enabledProvided := raw["enabled"]
	updated, err := h.Settings.UpdateProvider(r.Context(), mux.Vars(r)["id"], cfg, enabledProvided)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated.Masked())
}

func (h *Handler) DeleteProvider(w http.ResponseWriter, r *http.Request) {
	if err := h.Settings.DeleteProvider(r.Context(), mux.Vars(r)["id"]); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) providerByID(r *http.Request) (*models.ProviderConfig, error) {
	settings, err := h.Settings.Get(r.Context())
	if err != nil {
		return nil, err
	}
	p := settings.FindProvider(mux.Vars(r)["id"])
	if p == nil {
		return nil, store.ErrNotFound
	}
	return p, nil
}

func (h *Handler) ProviderModels(w http.ResponseWriter, r *http.Request) {
	p, err := h.providerByID(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	list, err := h.Providers.ListModels(r.Context(), *p)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) TestProvider(w http.ResponseWriter, r *http.Request) {
	p, err := h.providerByID(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, h.Providers.Test(r.Context(), *p))
}

func (h *Handler) TestUnsavedProvider(w http.ResponseWriter, r *http.Request) {
	var cfg models.ProviderConfig
	if err := decode(r, &cfg); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	cfg = h.Providers.WithStoredKey(r.Context(), cfg)
	if cfg.BaseURL == "" {
		for _, p := range providers.Presets() {
			if p.ID == cfg.Type {
				cfg.BaseURL = p.BaseURL
			}
		}
	}
	if strings.Contains(r.URL.RawQuery, "models") {
		list, err := h.Providers.ListModels(r.Context(), cfg)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, list)
		return
	}
	writeJSON(w, http.StatusOK, h.Providers.Test(r.Context(), cfg))
}

// ---------- user ----------

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	u, err := h.Settings.GetUser(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username    *string `json:"username"`
		AboutMe     *string `json:"aboutMe"`
		Preferences *string `json:"preferences"`
	}
	if err := decode(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	u, err := h.Settings.UpdateUser(r.Context(), in.Username, in.AboutMe, in.Preferences)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// ---------- chats ----------

func (h *Handler) ListChats(w http.ResponseWriter, r *http.Request) {
	chats, err := h.Chats.List(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chats)
}

func (h *Handler) CreateChat(w http.ResponseWriter, r *http.Request) {
	var in services.CreateInput
	if err := decode(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	chat, err := h.Chats.Create(r.Context(), in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, chat)
}

func (h *Handler) GetChat(w http.ResponseWriter, r *http.Request) {
	chat, err := h.Chats.Get(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chat)
}

func (h *Handler) PatchChat(w http.ResponseWriter, r *http.Request) {
	var in services.PatchInput
	if err := decode(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	chat, err := h.Chats.Patch(r.Context(), mux.Vars(r)["id"], in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chat)
}

func (h *Handler) DeleteChat(w http.ResponseWriter, r *http.Request) {
	if err := h.Chats.Delete(r.Context(), mux.Vars(r)["id"]); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteAllChats(w http.ResponseWriter, r *http.Request) {
	if err := h.Chats.DeleteAll(r.Context()); err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ExportChat(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	format := r.URL.Query().Get("format")
	if format == "json" {
		data, name, err := h.Chats.ExportJSON(r.Context(), id)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name))
		_, _ = w.Write(data)
		return
	}
	assistant := ""
	if settings, err := h.Settings.Get(r.Context()); err == nil {
		assistant = settings.Assistant.Name
	}
	md, name, err := h.Chats.ExportMarkdown(r.Context(), id, assistant)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name))
	_, _ = io.WriteString(w, md)
}

func (h *Handler) UpdateMessage(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Content       string `json:"content"`
		TruncateAfter bool   `json:"truncateAfter"`
	}
	if err := decode(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	vars := mux.Vars(r)
	chat, err := h.Chats.UpdateMessage(r.Context(), vars["id"], vars["mid"], in.Content, in.TruncateAfter)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chat)
}

func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cascade := r.URL.Query().Get("cascade") == "true"
	chat, err := h.Chats.DeleteMessage(r.Context(), vars["id"], vars["mid"], cascade)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chat)
}

// ---------- streaming ----------

// streamErrorBeforeStart reports failures that happen before any SSE byte was written.
func (h *Handler) stream(w http.ResponseWriter, r *http.Request, run func(ctx context.Context, sink services.Sink) error) {
	// Validate up-front errors with a plain JSON response, which is far easier for clients to handle.
	sse, err := newSSEWriter(w)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer sse.Close()
	if err := run(r.Context(), sse); err != nil && !errors.Is(err, errClientGone) {
		if r.Context().Err() != nil {
			return
		}
		msg := err.Error()
		if errors.Is(err, services.ErrValidation) {
			msg = strings.TrimPrefix(msg, services.ErrValidation.Error()+": ")
		}
		if errors.Is(err, store.ErrNotFound) {
			msg = "chat or message not found"
		}
		_ = sse.Emit("error", map[string]string{"message": msg})
		_ = sse.Emit("done", map[string]any{"message": nil, "chat": nil})
	}
}

func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	var in services.SendInput
	if err := decode(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(in.Content) == "" && strings.TrimSpace(in.Message) == "" && len(in.Images) == 0 {
		writeError(w, http.StatusBadRequest, "message content is required")
		return
	}
	// Resolve the provider before switching to SSE so configuration errors come back as JSON.
	var chat *models.Chat
	if in.ChatID != "" {
		c, err := h.Chats.Get(r.Context(), in.ChatID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		chat = c
	}
	if _, err := h.Providers.Resolve(r.Context(), chat, in.ProviderID, in.Model); err != nil {
		writeServiceError(w, err)
		return
	}
	h.stream(w, r, func(ctx context.Context, sink services.Sink) error {
		return h.Chats.Send(ctx, in, sink)
	})
}

func (h *Handler) Regenerate(w http.ResponseWriter, r *http.Request) {
	var in services.RegenerateInput
	if err := decode(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	id := mux.Vars(r)["id"]
	chat, err := h.Chats.Get(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if _, err := h.Providers.Resolve(r.Context(), chat, in.ProviderID, in.Model); err != nil {
		writeServiceError(w, err)
		return
	}
	h.stream(w, r, func(ctx context.Context, sink services.Sink) error {
		return h.Chats.Regenerate(ctx, id, in, sink)
	})
}

// ---------- data ----------

func (h *Handler) ExportAll(w http.ResponseWriter, r *http.Request) {
	backup, err := h.Chats.ExportAll(r.Context(), config.Version)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", "localmind-backup-"+time.Now().Format("2006-01-02")+".json"))
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(backup)
}

func (h *Handler) ImportAll(w http.ResponseWriter, r *http.Request) {
	var backup services.Backup
	if err := decode(r, &backup); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	n, err := h.Chats.ImportAll(r.Context(), &backup)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"chatsImported": n})
}

// ---------- legacy ----------

// LegacyCreateUser keeps `start.sh --init` from older versions working.
func (h *Handler) LegacyCreateUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
		AboutMe  string `json:"aboutMe"`
	}
	_ = decode(r, &in)
	var username, about *string
	if strings.TrimSpace(in.Username) != "" {
		username = &in.Username
	}
	if in.AboutMe != "" {
		about = &in.AboutMe
	}
	u, err := h.Settings.UpdateUser(r.Context(), username, about, nil)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success", "userId": u.ID, "username": u.Username})
}

// LegacyChatInit creates a welcome chat if there are no chats yet.
func (h *Handler) LegacyChatInit(w http.ResponseWriter, r *http.Request) {
	chats, err := h.Chats.List(r.Context(), "")
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if len(chats) > 0 {
		writeJSON(w, http.StatusOK, map[string]string{"status": "exists"})
		return
	}
	settings, _ := h.Settings.Get(r.Context())
	user, _ := h.Settings.GetUser(r.Context())
	name, who := "your assistant", "there"
	if settings != nil && settings.Assistant.Name != "" {
		name = settings.Assistant.Name
	}
	if user != nil && user.Username != "" {
		who = user.Username
	}
	chat, err := h.Chats.Create(r.Context(), services.CreateInput{Title: "Welcome"})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	greeting := fmt.Sprintf("Hi %s, it's a pleasure to meet you! I'm %s. Everything you type here stays on your machine. Pick a provider and model in Settings and let's talk.", who, name)
	if _, err := h.Chats.AppendAssistantMessage(r.Context(), chat.ID, greeting); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "success", "chatId": chat.ID})
}
