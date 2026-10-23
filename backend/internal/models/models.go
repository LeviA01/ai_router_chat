package models

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"created_at"`
}

type Provider struct {
	ID       string   `json:"id"`
	UserID   string   `json:"-"`
	Name     string   `json:"name"`
	BaseURL  string   `json:"base_url"`
	APIKey   string   `json:"api_key,omitempty"`
	Kind     string   `json:"kind"`
	Models   []string `json:"models"`
	HasKey   bool     `json:"has_key"`
	CreatedAt string  `json:"created_at"`
}

type Chat struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	ProviderID string `json:"provider_id"`
	Model      string `json:"model"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

type Message struct {
	ID        string `json:"id"`
	ChatID    string `json:"chat_id"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
