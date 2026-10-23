package store

import (
	"database/sql"
	"errors"
	"time"

	"ai-chat/internal/models"
	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// ---------- users ----------

func (s *Store) CreateUser(email, name, passwordHash string) (models.User, error) {
	u := models.User{
		ID:           uuid.NewString(),
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
		CreatedAt:    now(),
	}
	_, err := s.db.Exec(
		`INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.Name, u.PasswordHash, u.CreatedAt,
	)
	if err != nil {
		return models.User{}, err
	}
	return u, nil
}

func (s *Store) UserByEmail(email string) (models.User, error) {
	var u models.User
	err := s.db.QueryRow(
		`SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) UserByID(id string) (models.User, error) {
	var u models.User
	err := s.db.QueryRow(
		`SELECT id, email, name, password_hash, created_at FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

// ---------- providers ----------

func (s *Store) ListProviders(userID string) ([]models.Provider, error) {
	rows, err := s.db.Query(
		`SELECT id, user_id, name, base_url, api_key, kind, models_json, created_at
		 FROM providers WHERE user_id = ? ORDER BY created_at ASC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Provider{}
	for rows.Next() {
		p, err := scanProvider(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanProvider(sc scanner) (models.Provider, error) {
	var p models.Provider
	var modelsJSON string
	err := sc.Scan(&p.ID, &p.UserID, &p.Name, &p.BaseURL, &p.APIKey, &p.Kind, &modelsJSON, &p.CreatedAt)
	if err != nil {
		return p, err
	}
	p.Models = decodeModels(modelsJSON)
	p.HasKey = p.APIKey != ""
	return p, nil
}

func (s *Store) ProviderByID(userID, id string) (models.Provider, error) {
	row := s.db.QueryRow(
		`SELECT id, user_id, name, base_url, api_key, kind, models_json, created_at
		 FROM providers WHERE id = ? AND user_id = ?`, id, userID,
	)
	p, err := scanProvider(row)
	if errors.Is(err, sql.ErrNoRows) {
		return p, ErrNotFound
	}
	return p, err
}

func (s *Store) CreateProvider(p models.Provider) (models.Provider, error) {
	p.ID = uuid.NewString()
	p.CreatedAt = now()
	if p.Kind == "" {
		p.Kind = "openai_compatible"
	}
	_, err := s.db.Exec(
		`INSERT INTO providers (id, user_id, name, base_url, api_key, kind, models_json, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.UserID, p.Name, p.BaseURL, p.APIKey, p.Kind, encodeModels(p.Models), p.CreatedAt,
	)
	if err != nil {
		return p, err
	}
	p.HasKey = p.APIKey != ""
	return p, nil
}

func (s *Store) UpdateProvider(p models.Provider) error {
	res, err := s.db.Exec(
		`UPDATE providers SET name = ?, base_url = ?, api_key = ?, kind = ?, models_json = ?
		 WHERE id = ? AND user_id = ?`,
		p.Name, p.BaseURL, p.APIKey, p.Kind, encodeModels(p.Models), p.ID, p.UserID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteProvider(userID, id string) error {
	res, err := s.db.Exec(`DELETE FROM providers WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- chats ----------

func (s *Store) ListChats(userID string) ([]models.Chat, error) {
	rows, err := s.db.Query(
		`SELECT id, title, provider_id, model, created_at, updated_at
		 FROM chats WHERE user_id = ? ORDER BY updated_at DESC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Chat{}
	for rows.Next() {
		var c models.Chat
		if err := rows.Scan(&c.ID, &c.Title, &c.ProviderID, &c.Model, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) ChatByID(userID, id string) (models.Chat, error) {
	var c models.Chat
	err := s.db.QueryRow(
		`SELECT id, title, provider_id, model, created_at, updated_at
		 FROM chats WHERE id = ? AND user_id = ?`, id, userID,
	).Scan(&c.ID, &c.Title, &c.ProviderID, &c.Model, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}

func (s *Store) CreateChat(userID string, c models.Chat) (models.Chat, error) {
	c.ID = uuid.NewString()
	if c.Title == "" {
		c.Title = "New chat"
	}
	c.CreatedAt = now()
	c.UpdatedAt = c.CreatedAt
	_, err := s.db.Exec(
		`INSERT INTO chats (id, user_id, title, provider_id, model, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		c.ID, userID, c.Title, c.ProviderID, c.Model, c.CreatedAt, c.UpdatedAt,
	)
	if err != nil {
		return c, err
	}
	return c, nil
}

func (s *Store) UpdateChat(userID string, c models.Chat) error {
	res, err := s.db.Exec(
		`UPDATE chats SET title = ?, provider_id = ?, model = ?, updated_at = ?
		 WHERE id = ? AND user_id = ?`,
		c.Title, c.ProviderID, c.Model, now(), c.ID, userID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) TouchChat(userID, id string) error {
	_, err := s.db.Exec(`UPDATE chats SET updated_at = ? WHERE id = ? AND user_id = ?`, now(), id, userID)
	return err
}

func (s *Store) DeleteChat(userID, id string) error {
	res, err := s.db.Exec(`DELETE FROM chats WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- messages ----------

func (s *Store) ListMessages(userID, chatID string) ([]models.Message, error) {
	if _, err := s.ChatByID(userID, chatID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(
		`SELECT id, chat_id, role, content, created_at
		 FROM messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC`, chatID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Message{}
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.ChatID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) AddMessage(chatID, role, content string) (models.Message, error) {
	m := models.Message{
		ID:        uuid.NewString(),
		ChatID:    chatID,
		Role:      role,
		Content:   content,
		CreatedAt: now(),
	}
	_, err := s.db.Exec(
		`INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
		m.ID, m.ChatID, m.Role, m.Content, m.CreatedAt,
	)
	return m, err
}
