// Package mongo is the MongoDB storage backend (the original LocalMind store).
package mongo

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/store"
	"github.com/ashuthe1/localmind/utils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Store is a MongoDB-backed store.Store.
type Store struct {
	client   *mongo.Client
	chats    *mongo.Collection
	users    *mongo.Collection
	settings *mongo.Collection
}

// Open connects to MongoDB and migrates legacy documents.
func Open(ctx context.Context, uri, database string) (*Store, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("pinging MongoDB at %s: %w", uri, err)
	}
	db := client.Database(database)
	s := &Store{client: client, chats: db.Collection("chats"), users: db.Collection("users"), settings: db.Collection("settings")}
	if err := s.migrateLegacy(ctx); err != nil {
		return nil, fmt.Errorf("migrating legacy documents: %w", err)
	}
	return s, nil
}

func (s *Store) Name() string { return "mongo" }

func (s *Store) Close() error { return s.client.Disconnect(context.Background()) }

// migrateLegacy converts documents written by LocalMind 1.x (ObjectID ids) to string ids.
func (s *Store) migrateLegacy(ctx context.Context) error {
	for _, coll := range []*mongo.Collection{s.chats, s.users} {
		cursor, err := coll.Find(ctx, bson.M{"_id": bson.M{"$type": "objectId"}})
		if err != nil {
			return err
		}
		var docs []bson.M
		if err := cursor.All(ctx, &docs); err != nil {
			return err
		}
		for _, doc := range docs {
			oldID, ok := doc["_id"].(primitive.ObjectID)
			if !ok {
				continue
			}
			doc["_id"] = oldID.Hex()
			if msgs, ok := doc["messages"].(primitive.A); ok {
				for i, raw := range msgs {
					if m, ok := raw.(bson.M); ok {
						if mid, ok := m["_id"].(primitive.ObjectID); ok {
							m["_id"] = mid.Hex()
						}
						msgs[i] = m
					}
				}
				doc["messages"] = msgs
			}
			if _, err := coll.InsertOne(ctx, doc); err != nil && !mongo.IsDuplicateKeyError(err) {
				return err
			}
			if _, err := coll.DeleteOne(ctx, bson.M{"_id": oldID}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Store) CreateChat(ctx context.Context, chat *models.Chat) error {
	if chat.ID == "" {
		chat.ID = utils.NewID()
	}
	now := utils.NowUTC()
	if chat.CreatedAt.IsZero() {
		chat.CreatedAt = now
	}
	chat.UpdatedAt = now
	ensureMessageIDs(chat)
	if chat.Messages == nil {
		chat.Messages = []models.Message{}
	}
	_, err := s.chats.InsertOne(ctx, chat)
	return err
}

func ensureMessageIDs(chat *models.Chat) {
	for i := range chat.Messages {
		if chat.Messages[i].ID == "" {
			chat.Messages[i].ID = utils.NewID()
		}
		if chat.Messages[i].Timestamp.IsZero() {
			chat.Messages[i].Timestamp = utils.NowUTC()
		}
	}
}

func (s *Store) GetChat(ctx context.Context, id string) (*models.Chat, error) {
	var chat models.Chat
	err := s.chats.FindOne(ctx, bson.M{"_id": id}).Decode(&chat)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, store.ErrNotFound
		}
		return nil, err
	}
	if chat.Messages == nil {
		chat.Messages = []models.Message{}
	}
	if chat.Meta == nil {
		chat.Meta = map[string]string{}
	}
	return &chat, nil
}

func (s *Store) ListChats(ctx context.Context, opts store.ListOptions) ([]models.ChatSummary, error) {
	match := bson.M{}
	if !opts.IncludeArchived {
		match["archived"] = bson.M{"$ne": true}
	}
	if q := strings.TrimSpace(opts.Query); q != "" {
		re := primitive.Regex{Pattern: regexQuote(q), Options: "i"}
		match["$or"] = bson.A{bson.M{"title": re}, bson.M{"messages.content": re}}
	}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$project", Value: bson.M{
			"title": 1, "pinned": 1, "archived": 1, "providerId": 1, "model": 1, "createdAt": 1, "updatedAt": 1,
			"messageCount": bson.M{"$size": bson.M{"$ifNull": bson.A{"$messages", bson.A{}}}},
			"last":         bson.M{"$arrayElemAt": bson.A{"$messages", -1}},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "pinned", Value: -1}, {Key: "updatedAt", Value: -1}}}},
	}
	cursor, err := s.chats.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	out := []models.ChatSummary{}
	for cursor.Next(ctx) {
		var row struct {
			ID           string    `bson:"_id"`
			Title        string    `bson:"title"`
			Pinned       bool      `bson:"pinned"`
			Archived     bool      `bson:"archived"`
			ProviderID   string    `bson:"providerId"`
			Model        string    `bson:"model"`
			CreatedAt    time.Time `bson:"createdAt"`
			UpdatedAt    time.Time `bson:"updatedAt"`
			MessageCount int       `bson:"messageCount"`
			Last         *struct {
				Content   string    `bson:"content"`
				Timestamp time.Time `bson:"timestamp"`
			} `bson:"last"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		c := models.ChatSummary{ID: row.ID, Title: row.Title, Pinned: row.Pinned, Archived: row.Archived, ProviderID: row.ProviderID, Model: row.Model, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt, MessageCount: row.MessageCount}
		if row.Last != nil {
			preview := []rune(row.Last.Content)
			if len(preview) > 120 {
				preview = append(preview[:120], '…')
			}
			c.LastMessagePreview = string(preview)
			t := row.Last.Timestamp
			c.LastMessageAt = &t
		}
		out = append(out, c)
	}
	return out, cursor.Err()
}

func regexQuote(s string) string {
	var b strings.Builder
	for _, r := range s {
		if strings.ContainsRune(`\.+*?()|[]{}^$`, r) {
			b.WriteRune('\\')
		}
		b.WriteRune(r)
	}
	return b.String()
}

func (s *Store) UpdateChat(ctx context.Context, chat *models.Chat) error {
	chat.UpdatedAt = utils.NowUTC()
	ensureMessageIDs(chat)
	res, err := s.chats.ReplaceOne(ctx, bson.M{"_id": chat.ID}, chat)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *Store) DeleteChat(ctx context.Context, id string) error {
	res, err := s.chats.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *Store) DeleteAllChats(ctx context.Context) error {
	_, err := s.chats.DeleteMany(ctx, bson.M{})
	return err
}

func (s *Store) GetUser(ctx context.Context) (*models.User, error) {
	var u models.User
	err := s.users.FindOne(ctx, bson.M{}, options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: 1}})).Decode(&u)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, store.ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (s *Store) SaveUser(ctx context.Context, user *models.User) error {
	if user.ID == "" {
		user.ID = utils.NewID()
	}
	user.UpdatedAt = utils.NowUTC()
	if user.CreatedAt.IsZero() {
		user.CreatedAt = user.UpdatedAt
	}
	_, err := s.users.ReplaceOne(ctx, bson.M{"_id": user.ID}, user, options.Replace().SetUpsert(true))
	return err
}

type settingsDoc struct {
	ID       string          `bson:"_id"`
	Settings models.Settings `bson:"settings"`
}

func (s *Store) GetSettings(ctx context.Context) (*models.Settings, error) {
	var doc settingsDoc
	err := s.settings.FindOne(ctx, bson.M{"_id": "settings"}).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, store.ErrNotFound
		}
		return nil, err
	}
	doc.Settings.Normalize()
	return &doc.Settings, nil
}

func (s *Store) SaveSettings(ctx context.Context, settings *models.Settings) error {
	settings.UpdatedAt = utils.NowUTC()
	settings.Normalize()
	_, err := s.settings.ReplaceOne(ctx, bson.M{"_id": "settings"}, settingsDoc{ID: "settings", Settings: *settings}, options.Replace().SetUpsert(true))
	return err
}
