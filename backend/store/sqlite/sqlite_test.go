package sqlite

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/store"
)

func TestChatRoundTrip(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()

	chat := &models.Chat{Title: "Hello", Messages: []models.Message{
		{Role: "user", Content: "hi", Images: []models.Image{{Name: "a.png", MimeType: "image/png", Data: "QUJD"}}},
		{Role: "assistant", Content: "hello", Reasoning: "think", Stats: &models.Stats{OutputTokens: 3}},
	}, Meta: map[string]string{"k": "v"}}
	if err := s.CreateChat(ctx, chat); err != nil {
		t.Fatal(err)
	}
	got, err := s.GetChat(ctx, chat.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Messages) != 2 || got.Messages[0].Images[0].Data != "QUJD" || got.Messages[1].Stats.OutputTokens != 3 || got.Meta["k"] != "v" || got.Messages[1].Reasoning != "think" {
		t.Fatalf("round trip mismatch: %+v", got)
	}
	if got.Messages[0].ID == "" || got.Messages[0].Timestamp.IsZero() {
		t.Fatalf("message ids/timestamps not assigned")
	}

	got.Messages = got.Messages[:1]
	got.Pinned = true
	if err := s.UpdateChat(ctx, got); err != nil {
		t.Fatal(err)
	}
	other := &models.Chat{Title: "Other", Messages: []models.Message{{Role: "user", Content: "find needle here"}}}
	_ = s.CreateChat(ctx, other)

	list, err := s.ListChats(ctx, store.ListOptions{})
	if err != nil || len(list) != 2 {
		t.Fatalf("list: %v %v", list, err)
	}
	if list[0].ID != chat.ID || !list[0].Pinned || list[0].MessageCount != 1 {
		t.Fatalf("pinned chat should sort first with 1 message: %+v", list[0])
	}
	hits, _ := s.ListChats(ctx, store.ListOptions{Query: "NEEDLE"})
	if len(hits) != 1 || hits[0].ID != other.ID {
		t.Fatalf("search failed: %+v", hits)
	}
	if err := s.DeleteChat(ctx, other.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetChat(ctx, other.ID); err != store.ErrNotFound {
		t.Fatalf("expected not found, got %v", err)
	}

	if _, err := s.GetSettings(ctx); err != store.ErrNotFound {
		t.Fatalf("expected no settings yet, got %v", err)
	}
	st := models.DefaultSettings()
	st.Providers = append(st.Providers, models.ProviderConfig{ID: "p1", Type: "ollama", APIKey: "secret"})
	if err := s.SaveSettings(ctx, st); err != nil {
		t.Fatal(err)
	}
	loaded, err := s.GetSettings(ctx)
	if err != nil || loaded.Providers[0].APIKey != "secret" || loaded.Assistant.Name != "Smriti" {
		t.Fatalf("settings round trip: %+v %v", loaded, err)
	}
	u := &models.User{Username: "sam"}
	if err := s.SaveUser(ctx, u); err != nil {
		t.Fatal(err)
	}
	if lu, err := s.GetUser(ctx); err != nil || lu.Username != "sam" || lu.ID == "" {
		t.Fatalf("user round trip: %+v %v", lu, err)
	}
}
