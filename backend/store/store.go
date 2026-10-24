// Package store defines the persistence interface and shared errors.
package store

import (
	"context"
	"errors"

	"github.com/ashuthe1/localmind/models"
)

// ErrNotFound is returned when a record does not exist.
var ErrNotFound = errors.New("not found")

// ListOptions filters chat listings.
type ListOptions struct {
	Query           string
	IncludeArchived bool
}

// Store is implemented by every storage backend.
type Store interface {
	Name() string

	CreateChat(ctx context.Context, chat *models.Chat) error
	GetChat(ctx context.Context, id string) (*models.Chat, error)
	ListChats(ctx context.Context, opts ListOptions) ([]models.ChatSummary, error)
	UpdateChat(ctx context.Context, chat *models.Chat) error
	DeleteChat(ctx context.Context, id string) error
	DeleteAllChats(ctx context.Context) error

	GetUser(ctx context.Context) (*models.User, error)
	SaveUser(ctx context.Context, user *models.User) error

	GetSettings(ctx context.Context) (*models.Settings, error)
	SaveSettings(ctx context.Context, settings *models.Settings) error

	Close() error
}
