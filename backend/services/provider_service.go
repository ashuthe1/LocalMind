package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/providers"
)

// TestResult is the outcome of a provider connectivity test.
type TestResult struct {
	OK         bool                  `json:"ok"`
	LatencyMs  int64                 `json:"latencyMs"`
	ModelCount int                   `json:"modelCount"`
	Message    string                `json:"message"`
	Error      string                `json:"error"`
	Models     []providers.ModelInfo `json:"models,omitempty"`
}

// ProviderService builds providers and answers model/connectivity questions.
type ProviderService struct {
	settings *SettingsService
}

func NewProviderService(settings *SettingsService) *ProviderService {
	return &ProviderService{settings: settings}
}

// Build constructs a provider from its config.
func (p *ProviderService) Build(cfg models.ProviderConfig) (providers.Provider, error) {
	return providers.New(cfg)
}

// WithStoredKey fills in the stored API key when a client sends a config without one.
func (p *ProviderService) WithStoredKey(ctx context.Context, cfg models.ProviderConfig) models.ProviderConfig {
	if strings.TrimSpace(cfg.APIKey) != "" || cfg.ID == "" {
		return cfg
	}
	settings, err := p.settings.Get(ctx)
	if err != nil {
		return cfg
	}
	if stored := settings.FindProvider(cfg.ID); stored != nil {
		cfg.APIKey = stored.APIKey
	}
	return cfg
}

// ListModels returns the provider's models, falling back to the manual list.
func (p *ProviderService) ListModels(ctx context.Context, cfg models.ProviderConfig) ([]providers.ModelInfo, error) {
	manual := make([]providers.ModelInfo, 0, len(cfg.Models))
	for _, m := range cfg.Models {
		if m = strings.TrimSpace(m); m != "" {
			manual = append(manual, providers.ModelInfo{ID: m, Name: m})
		}
	}
	prov, err := providers.New(cfg)
	if err != nil {
		return manual, err
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	list, err := prov.ListModels(ctx)
	if err != nil {
		if len(manual) > 0 {
			return manual, nil
		}
		return nil, err
	}
	seen := map[string]bool{}
	for _, m := range list {
		seen[m.ID] = true
	}
	for _, m := range manual {
		if !seen[m.ID] {
			list = append(list, m)
		}
	}
	if cfg.DefaultModel != "" && !seen[cfg.DefaultModel] {
		list = append(list, providers.ModelInfo{ID: cfg.DefaultModel, Name: cfg.DefaultModel})
	}
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].Loaded != list[j].Loaded {
			return list[i].Loaded
		}
		return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name)
	})
	return list, nil
}

// Test checks connectivity by listing models.
func (p *ProviderService) Test(ctx context.Context, cfg models.ProviderConfig) TestResult {
	start := time.Now()
	prov, err := providers.New(cfg)
	if err != nil {
		return TestResult{Error: err.Error()}
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	list, err := prov.ListModels(ctx)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		if len(cfg.Models) > 0 {
			return TestResult{OK: true, LatencyMs: latency, ModelCount: len(cfg.Models), Message: "Model listing failed; using the manual model list", Error: err.Error()}
		}
		return TestResult{LatencyMs: latency, Error: err.Error()}
	}
	msg := fmt.Sprintf("Connected — %d model(s) available", len(list))
	if len(list) == 0 {
		msg = "Connected, but the server reports no models"
	}
	return TestResult{OK: true, LatencyMs: latency, ModelCount: len(list), Message: msg, Models: list}
}

// Target is the resolved provider + model for a request.
type Target struct {
	Config models.ProviderConfig
	Model  string
}

// ErrNoProvider is returned when nothing is configured.
var ErrNoProvider = errors.New("no LLM provider is configured — add one in Settings")

// Resolve picks the provider and model: explicit override > chat override > active defaults.
func (p *ProviderService) Resolve(ctx context.Context, chat *models.Chat, providerID, model string) (*Target, error) {
	settings, err := p.settings.Get(ctx)
	if err != nil {
		return nil, err
	}
	pid := providerID
	if pid == "" && chat != nil {
		pid = chat.ProviderID
	}
	if pid == "" {
		pid = settings.ActiveProviderID
	}
	if pid == "" {
		for _, c := range settings.Providers {
			if c.Enabled {
				pid = c.ID
				break
			}
		}
	}
	if pid == "" {
		return nil, ErrNoProvider
	}
	cfg := settings.FindProvider(pid)
	if cfg == nil {
		// Chat may reference a deleted provider; fall back to the active one.
		if settings.ActiveProviderID != "" && pid != settings.ActiveProviderID {
			cfg = settings.FindProvider(settings.ActiveProviderID)
			model = ""
		}
		if cfg == nil {
			return nil, ErrNoProvider
		}
	}
	if !cfg.Enabled {
		return nil, validationErr("provider %q is disabled — enable it in Settings", cfg.Name)
	}
	if model == "" && chat != nil && chat.ProviderID == cfg.ID {
		model = chat.Model
	}
	if model == "" && settings.ActiveProviderID == cfg.ID {
		model = settings.ActiveModel
	}
	if model == "" {
		model = cfg.DefaultModel
	}
	if model == "" {
		// Last resort: ask the provider for the first available model.
		list, err := p.ListModels(ctx, *cfg)
		if err == nil && len(list) > 0 {
			model = list[0].ID
		}
	}
	if model == "" {
		return nil, validationErr("no model selected for provider %q — choose one in Settings", cfg.Name)
	}
	return &Target{Config: *cfg, Model: model}, nil
}
