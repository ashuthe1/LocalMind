// Package sqlite is the default zero-configuration storage backend (pure Go, no CGO).
package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/store"
	"github.com/ashuthe1/localmind/utils"
	_ "modernc.org/sqlite"
)

// Store is a SQLite-backed store.Store.
type Store struct {
	db *sql.DB
}

// Open opens (and migrates) the database file at path.
func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("creating data directory: %w", err)
	}
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // SQLite is single-writer; serialize access for simplicity.
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Name() string { return "sqlite" }

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS chats (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL DEFAULT '',
			pinned INTEGER NOT NULL DEFAULT 0,
			archived INTEGER NOT NULL DEFAULT 0,
			provider_id TEXT NOT NULL DEFAULT '',
			model TEXT NOT NULL DEFAULT '',
			system_prompt TEXT NOT NULL DEFAULT '',
			meta TEXT NOT NULL DEFAULT '{}',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
			position INTEGER NOT NULL,
			role TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			reasoning TEXT NOT NULL DEFAULT '',
			images TEXT NOT NULL DEFAULT '[]',
			model TEXT NOT NULL DEFAULT '',
			provider_id TEXT NOT NULL DEFAULT '',
			provider_name TEXT NOT NULL DEFAULT '',
			timestamp TEXT NOT NULL,
			edited_at TEXT,
			stats TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, position)`,
		`CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(pinned DESC, updated_at DESC)`,
		`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("migrating schema: %w", err)
		}
	}
	return nil
}

const timeLayout = time.RFC3339Nano

func fmtTime(t time.Time) string { return t.UTC().Format(timeLayout) }

func parseTime(s string) time.Time {
	t, err := time.Parse(timeLayout, s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
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
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	meta, _ := json.Marshal(orEmptyMeta(chat.Meta))
	_, err = tx.ExecContext(ctx, `INSERT INTO chats (id,title,pinned,archived,provider_id,model,system_prompt,meta,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
		chat.ID, chat.Title, boolInt(chat.Pinned), boolInt(chat.Archived), chat.ProviderID, chat.Model, chat.SystemPrompt, string(meta), fmtTime(chat.CreatedAt), fmtTime(chat.UpdatedAt))
	if err != nil {
		return err
	}
	if err := insertMessages(ctx, tx, chat); err != nil {
		return err
	}
	return tx.Commit()
}

func orEmptyMeta(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

func insertMessages(ctx context.Context, tx *sql.Tx, chat *models.Chat) error {
	for i := range chat.Messages {
		m := &chat.Messages[i]
		if m.ID == "" {
			m.ID = utils.NewID()
		}
		if m.Timestamp.IsZero() {
			m.Timestamp = utils.NowUTC()
		}
		images, _ := json.Marshal(m.Images)
		if m.Images == nil {
			images = []byte("[]")
		}
		var stats any
		if m.Stats != nil {
			b, _ := json.Marshal(m.Stats)
			stats = string(b)
		}
		var edited any
		if m.EditedAt != nil {
			edited = fmtTime(*m.EditedAt)
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO messages (id,chat_id,position,role,content,reasoning,images,model,provider_id,provider_name,timestamp,edited_at,stats) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			m.ID, chat.ID, i, m.Role, m.Content, m.Reasoning, string(images), m.Model, m.ProviderID, m.ProviderName, fmtTime(m.Timestamp), edited, stats)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) GetChat(ctx context.Context, id string) (*models.Chat, error) {
	row := s.db.QueryRowContext(ctx, `SELECT id,title,pinned,archived,provider_id,model,system_prompt,meta,created_at,updated_at FROM chats WHERE id = ?`, id)
	chat, err := scanChat(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrNotFound
		}
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,role,content,reasoning,images,model,provider_id,provider_name,timestamp,edited_at,stats FROM messages WHERE chat_id = ? ORDER BY position`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	chat.Messages = []models.Message{}
	for rows.Next() {
		var m models.Message
		var images, ts string
		var edited, stats sql.NullString
		if err := rows.Scan(&m.ID, &m.Role, &m.Content, &m.Reasoning, &images, &m.Model, &m.ProviderID, &m.ProviderName, &ts, &edited, &stats); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(images), &m.Images)
		m.Timestamp = parseTime(ts)
		if edited.Valid {
			t := parseTime(edited.String)
			m.EditedAt = &t
		}
		if stats.Valid {
			var st models.Stats
			if json.Unmarshal([]byte(stats.String), &st) == nil {
				m.Stats = &st
			}
		}
		chat.Messages = append(chat.Messages, m)
	}
	return chat, rows.Err()
}

type scanner interface{ Scan(dest ...any) error }

func scanChat(row scanner) (*models.Chat, error) {
	var c models.Chat
	var pinned, archived int
	var meta, created, updated string
	if err := row.Scan(&c.ID, &c.Title, &pinned, &archived, &c.ProviderID, &c.Model, &c.SystemPrompt, &meta, &created, &updated); err != nil {
		return nil, err
	}
	c.Pinned, c.Archived = pinned == 1, archived == 1
	c.Meta = map[string]string{}
	_ = json.Unmarshal([]byte(meta), &c.Meta)
	c.CreatedAt, c.UpdatedAt = parseTime(created), parseTime(updated)
	return &c, nil
}

func (s *Store) ListChats(ctx context.Context, opts store.ListOptions) ([]models.ChatSummary, error) {
	q := `SELECT c.id,c.title,c.pinned,c.archived,c.provider_id,c.model,c.created_at,c.updated_at,
	        (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS cnt,
	        (SELECT m.content FROM messages m WHERE m.chat_id = c.id ORDER BY m.position DESC LIMIT 1) AS last_content,
	        (SELECT m.timestamp FROM messages m WHERE m.chat_id = c.id ORDER BY m.position DESC LIMIT 1) AS last_ts
	      FROM chats c WHERE 1=1`
	args := []any{}
	if !opts.IncludeArchived {
		q += ` AND c.archived = 0`
	}
	if strings.TrimSpace(opts.Query) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(opts.Query)) + "%"
		q += ` AND (LOWER(c.title) LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id AND LOWER(m.content) LIKE ?))`
		args = append(args, like, like)
	}
	q += ` ORDER BY c.pinned DESC, c.updated_at DESC`
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ChatSummary{}
	for rows.Next() {
		var c models.ChatSummary
		var pinned, archived int
		var created, updated string
		var lastContent, lastTs sql.NullString
		if err := rows.Scan(&c.ID, &c.Title, &pinned, &archived, &c.ProviderID, &c.Model, &created, &updated, &c.MessageCount, &lastContent, &lastTs); err != nil {
			return nil, err
		}
		c.Pinned, c.Archived = pinned == 1, archived == 1
		c.CreatedAt, c.UpdatedAt = parseTime(created), parseTime(updated)
		if lastContent.Valid {
			preview := []rune(lastContent.String)
			if len(preview) > 120 {
				preview = append(preview[:120], '…')
			}
			c.LastMessagePreview = string(preview)
		}
		if lastTs.Valid {
			t := parseTime(lastTs.String)
			c.LastMessageAt = &t
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) UpdateChat(ctx context.Context, chat *models.Chat) error {
	chat.UpdatedAt = utils.NowUTC()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	meta, _ := json.Marshal(orEmptyMeta(chat.Meta))
	res, err := tx.ExecContext(ctx, `UPDATE chats SET title=?,pinned=?,archived=?,provider_id=?,model=?,system_prompt=?,meta=?,updated_at=? WHERE id=?`,
		chat.Title, boolInt(chat.Pinned), boolInt(chat.Archived), chat.ProviderID, chat.Model, chat.SystemPrompt, string(meta), fmtTime(chat.UpdatedAt), chat.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return store.ErrNotFound
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM messages WHERE chat_id = ?`, chat.ID); err != nil {
		return err
	}
	if err := insertMessages(ctx, tx, chat); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) DeleteChat(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM chats WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *Store) DeleteAllChats(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM chats`)
	return err
}

func (s *Store) getKV(ctx context.Context, key string, dest any) error {
	var value string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM kv WHERE key = ?`, key).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrNotFound
		}
		return err
	}
	return json.Unmarshal([]byte(value), dest)
}

func (s *Store) setKV(ctx context.Context, key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, string(b))
	return err
}

func (s *Store) GetUser(ctx context.Context) (*models.User, error) {
	var u models.User
	if err := s.getKV(ctx, "user", &u); err != nil {
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
	return s.setKV(ctx, "user", user)
}

func (s *Store) GetSettings(ctx context.Context) (*models.Settings, error) {
	var st models.Settings
	if err := s.getKV(ctx, "settings", &st); err != nil {
		return nil, err
	}
	st.Normalize()
	return &st, nil
}

func (s *Store) SaveSettings(ctx context.Context, settings *models.Settings) error {
	settings.UpdatedAt = utils.NowUTC()
	settings.Normalize()
	return s.setKV(ctx, "settings", settings)
}
