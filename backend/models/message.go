// models/message.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Message represents an individual message in a chat.
type Message struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Role      string             `bson:"role" json:"role"`       // 'user' or 'assistant'
	Content   string             `bson:"content" json:"content"` // Message text
	Timestamp time.Time          `bson:"timestamp" json:"timestamp"`
}