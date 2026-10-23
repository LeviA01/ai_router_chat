package httpapi

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"ai-chat/internal/auth"
	"ai-chat/internal/store"
	"github.com/go-chi/chi/v5"
)

type API struct {
	store *store.Store
	auth  *auth.Manager
}

func New(s *store.Store, a *auth.Manager) *API {
	return &API{store: s, auth: a}
}

func (a *API) Router() chi.Router {
	r := chi.NewRouter()
	r.Use(corsMiddleware)
	r.Use(loggingMiddleware)

	r.Post("/api/auth/register", a.handleRegister)
	r.Post("/api/auth/login", a.handleLogin)

	r.Group(func(r chi.Router) {
		r.Use(a.requireAuth)

		r.Get("/api/me", a.handleMe)

		r.Get("/api/providers", a.handleListProviders)
		r.Post("/api/providers", a.handleCreateProvider)
		r.Put("/api/providers/{id}", a.handleUpdateProvider)
		r.Delete("/api/providers/{id}", a.handleDeleteProvider)
		r.Post("/api/providers/{id}/models/refresh", a.handleRefreshModels)

		r.Get("/api/chats", a.handleListChats)
		r.Post("/api/chats", a.handleCreateChat)
		r.Get("/api/chats/{id}", a.handleGetChat)
		r.Put("/api/chats/{id}", a.handleUpdateChat)
		r.Delete("/api/chats/{id}", a.handleDeleteChat)
		r.Get("/api/chats/{id}/messages", a.handleListMessages)
		r.Post("/api/chats/{id}/messages", a.handleSendMessage)
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	return r
}

// ---------- middleware ----------

func (a *API) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "missing token")
			return
		}
		userID, err := a.auth.Parse(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		ctx := withUserID(r.Context(), userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

// ---------- helpers ----------

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write json: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
