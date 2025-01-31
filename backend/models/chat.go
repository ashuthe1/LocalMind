// models/chat.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Chat represents a chat session containing multiple messages.
type Chat struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title     string             `bson:"title" json:"title"`         // Optional title for the chat
	Messages  []Message          `bson:"messages" json:"messages"`   // Slice of messages
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"` // Chat creation time
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"` // Last update time
}