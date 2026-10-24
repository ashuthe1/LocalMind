package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/providers"
	"github.com/ashuthe1/localmind/store"
	"github.com/ashuthe1/localmind/utils"
)

// ErrValidation marks a user-facing input error.
var ErrValidation = errors.New("validation error")

func validationErr(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrValidation, fmt.Sprintf(format, args...))
}

// SettingsService owns the single settings document and the user profile.
type SettingsService struct {
	store store.Store
	mu    sync.RWMutex
	cache *models.Settings
}

func NewSettingsService(st store.Store) *SettingsService {
	return &SettingsService{store: st}
}

// Bootstrap makes sure settings and a profile exist, creating a default provider from env on first run.
func (s *SettingsService) Bootstrap(ctx context.Context, cfg *config.Config) error {
	settings, err := s.store.GetSettings(ctx)
	if errors.Is(err, store.ErrNotFound) {
		settings = models.DefaultSettings()
		err = nil
	}
	if err != nil {
		return err
	}
	if len(settings.Providers) == 0 && cfg.DefaultProvider != "" {
		preset := presetFor(cfg.DefaultProvider)
		p := models.ProviderConfig{
			ID: utils.NewID(), Type: cfg.DefaultProvider, Name: preset.Name, BaseURL: cfg.DefaultBaseURL,
			APIKey: cfg.DefaultAPIKey, DefaultModel: cfg.DefaultModel, Enabled: true,
			Headers: map[string]string{}, Models: []string{}, Options: map[string]any{},
		}
		if p.BaseURL == "" {
			p.BaseURL = preset.BaseURL
		}
		if p.Name == "" {
			p.Name = strings.Title(cfg.DefaultProvider)
		}
		settings.Providers = append(settings.Providers, p)
		settings.ActiveProviderID = p.ID
		settings.ActiveModel = cfg.DefaultModel
	}
	if err := s.store.SaveSettings(ctx, settings); err != nil {
		return err
	}
	s.mu.Lock()
	s.cache = settings
	s.mu.Unlock()

	if _, err := s.store.GetUser(ctx); errors.Is(err, store.ErrNotFound) {
		return s.store.SaveUser(ctx, &models.User{Username: cfg.UserName})
	} else if err != nil {
		return err
	}
	return nil
}

func presetFor(providerType string) providers.Preset {
	for _, p := range providers.Presets() {
		if p.ID == providerType {
			return p
		}
	}
	for _, t := range providers.Types() {
		if t.Type == providerType {
			return providers.Preset{Name: t.Label, Type: t.Type}
		}
	}
	return providers.Preset{Name: providerType, Type: providerType}
}

// Get returns a copy of the current settings (with secrets).
func (s *SettingsService) Get(ctx context.Context) (*models.Settings, error) {
	s.mu.RLock()
	if s.cache != nil {
		cp := *s.cache
		cp.Providers = append([]models.ProviderConfig(nil), s.cache.Providers...)
		s.mu.RUnlock()
		return &cp, nil
	}
	s.mu.RUnlock()
	settings, err := s.store.GetSettings(ctx)
	if errors.Is(err, store.ErrNotFound) {
		settings = models.DefaultSettings()
		err = nil
	}
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.cache = settings
	s.mu.Unlock()
	return settings, nil
}

func (s *SettingsService) save(ctx context.Context, settings *models.Settings) error {
	if err := s.store.SaveSettings(ctx, settings); err != nil {
		return err
	}
	s.mu.Lock()
	s.cache = settings
	s.mu.Unlock()
	return nil
}

// Update merges a partial JSON patch into the settings. Provider list changes are ignored here.
func (s *SettingsService) Update(ctx context.Context, patch map[string]json.RawMessage) (*models.Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := s.store.GetSettings(ctx)
	if errors.Is(err, store.ErrNotFound) {
		current = models.DefaultSettings()
		err = nil
	}
	if err != nil {
		return nil, err
	}
	delete(patch, "providers")
	delete(patch, "updatedAt")

	raw, err := json.Marshal(current)
	if err != nil {
		return nil, err
	}
	var merged map[string]json.RawMessage
	if err := json.Unmarshal(raw, &merged); err != nil {
		return nil, err
	}
	for k, v := range patch {
		if k == "appearance" {
			// shallow-merge appearance so clients can send single keys
			var cur, in map[string]any
			_ = json.Unmarshal(merged["appearance"], &cur)
			if err := json.Unmarshal(v, &in); err != nil {
				return nil, validationErr("appearance must be an object")
			}
			if cur == nil {
				cur = map[string]any{}
			}
			for ak, av := range in {
				cur[ak] = av
			}
			b, _ := json.Marshal(cur)
			merged[k] = b
			continue
		}
		merged[k] = v
	}
	out, err := json.Marshal(merged)
	if err != nil {
		return nil, err
	}
	var next models.Settings
	if err := json.Unmarshal(out, &next); err != nil {
		return nil, validationErr("invalid settings: %v", err)
	}
	next.Providers = current.Providers // keep secrets and the authoritative list
	if next.ActiveProviderID != "" && next.FindProvider(next.ActiveProviderID) == nil {
		return nil, validationErr("unknown provider id %q", next.ActiveProviderID)
	}
	if next.Features.HistoryLimit < 0 {
		next.Features.HistoryLimit = 0
	}
	if err := s.store.SaveSettings(ctx, &next); err != nil {
		return nil, err
	}
	s.cache = &next
	return &next, nil
}

// ---------- providers ----------

func validateProvider(p *models.ProviderConfig) error {
	p.Type = strings.ToLower(strings.TrimSpace(p.Type))
	p.Name = strings.TrimSpace(p.Name)
	p.BaseURL = strings.TrimRight(strings.TrimSpace(p.BaseURL), "/")
	known := false
	for _, t := range providers.Types() {
		if t.Type == p.Type {
			known = true
		}
	}
	if !known {
		return validationErr("unknown provider type %q", p.Type)
	}
	if p.Name == "" {
		p.Name = presetFor(p.Type).Name
	}
	if p.BaseURL == "" {
		p.BaseURL = presetFor(p.Type).BaseURL
	}
	if p.BaseURL == "" {
		return validationErr("base URL is required")
	}
	if !strings.HasPrefix(p.BaseURL, "http://") && !strings.HasPrefix(p.BaseURL, "https://") {
		return validationErr("base URL must start with http:// or https://")
	}
	if p.Headers == nil {
		p.Headers = map[string]string{}
	}
	if p.Models == nil {
		p.Models = []string{}
	}
	if p.Options == nil {
		p.Options = map[string]any{}
	}
	return nil
}

func (s *SettingsService) AddProvider(ctx context.Context, p models.ProviderConfig) (*models.ProviderConfig, error) {
	if err := validateProvider(&p); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	settings, err := s.store.GetSettings(ctx)
	if err != nil {
		return nil, err
	}
	p.ID = utils.NewID()
	p.APIKey = strings.TrimSpace(p.APIKey)
	p.Enabled = true
	settings.Providers = append(settings.Providers, p)
	if settings.ActiveProviderID == "" {
		settings.ActiveProviderID = p.ID
		settings.ActiveModel = p.DefaultModel
	}
	if err := s.store.SaveSettings(ctx, settings); err != nil {
		return nil, err
	}
	s.cache = settings
	return &p, nil
}

// UpdateProvider replaces a provider's config. When enabledProvided is false the current enabled flag is kept.
func (s *SettingsService) UpdateProvider(ctx context.Context, id string, in models.ProviderConfig, enabledProvided bool) (*models.ProviderConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	settings, err := s.store.GetSettings(ctx)
	if err != nil {
		return nil, err
	}
	existing := settings.FindProvider(id)
	if existing == nil {
		return nil, store.ErrNotFound
	}
	in.ID = id
	if in.Type == "" {
		in.Type = existing.Type
	}
	if err := validateProvider(&in); err != nil {
		return nil, err
	}
	switch {
	case in.ClearAPIKey:
		in.APIKey = ""
	case strings.TrimSpace(in.APIKey) == "":
		in.APIKey = existing.APIKey
	default:
		in.APIKey = strings.TrimSpace(in.APIKey)
	}
	in.ClearAPIKey = false
	if !enabledProvided {
		in.Enabled = existing.Enabled
	}
	*existing = in
	if settings.ActiveProviderID == id && settings.ActiveModel == "" {
		settings.ActiveModel = in.DefaultModel
	}
	if err := s.store.SaveSettings(ctx, settings); err != nil {
		return nil, err
	}
	s.cache = settings
	return existing, nil
}

func (s *SettingsService) DeleteProvider(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	settings, err := s.store.GetSettings(ctx)
	if err != nil {
		return err
	}
	idx := -1
	for i, p := range settings.Providers {
		if p.ID == id {
			idx = i
		}
	}
	if idx < 0 {
		return store.ErrNotFound
	}
	settings.Providers = append(settings.Providers[:idx], settings.Providers[idx+1:]...)
	if settings.ActiveProviderID == id {
		settings.ActiveProviderID = ""
		settings.ActiveModel = ""
		for _, p := range settings.Providers {
			if p.Enabled {
				settings.ActiveProviderID = p.ID
				settings.ActiveModel = p.DefaultModel
				break
			}
		}
	}
	if err := s.store.SaveSettings(ctx, settings); err != nil {
		return err
	}
	s.cache = settings
	return nil
}

// SetActive switches the default provider/model.
func (s *SettingsService) SetActive(ctx context.Context, providerID, model string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	settings, err := s.store.GetSettings(ctx)
	if err != nil {
		return err
	}
	if settings.FindProvider(providerID) == nil {
		return store.ErrNotFound
	}
	settings.ActiveProviderID = providerID
	settings.ActiveModel = model
	if err := s.store.SaveSettings(ctx, settings); err != nil {
		return err
	}
	s.cache = settings
	return nil
}

// ---------- user profile ----------

func (s *SettingsService) GetUser(ctx context.Context) (*models.User, error) {
	u, err := s.store.GetUser(ctx)
	if errors.Is(err, store.ErrNotFound) {
		u = &models.User{Username: "friend"}
		if err := s.store.SaveUser(ctx, u); err != nil {
			return nil, err
		}
		return u, nil
	}
	return u, err
}

// UpdateUser applies the non-nil fields.
func (s *SettingsService) UpdateUser(ctx context.Context, username, aboutMe, preferences *string) (*models.User, error) {
	u, err := s.GetUser(ctx)
	if err != nil {
		return nil, err
	}
	if username != nil {
		if strings.TrimSpace(*username) == "" {
			return nil, validationErr("username cannot be empty")
		}
		u.Username = strings.TrimSpace(*username)
	}
	if aboutMe != nil {
		u.AboutMe = *aboutMe
	}
	if preferences != nil {
		u.Preferences = *preferences
	}
	if err := s.store.SaveUser(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// ReplaceUser overwrites the profile (used by import).
func (s *SettingsService) ReplaceUser(ctx context.Context, u *models.User) error {
	cur, err := s.GetUser(ctx)
	if err != nil {
		return err
	}
	u.ID = cur.ID
	u.CreatedAt = cur.CreatedAt
	return s.store.SaveUser(ctx, u)
}
