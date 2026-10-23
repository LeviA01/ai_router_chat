package httpapi

import (
	"context"
	"net/http"
	"strings"

	"ai-chat/internal/auth"
	"ai-chat/internal/models"
	"ai-chat/internal/store"
)

type ctxKey int

const userKey ctxKey = 1

func withUserID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, userKey, id)
}

func userIDFrom(ctx context.Context) string {
	val, _ := ctx.Value(userKey).(string)
	return val
}

type registerReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (a *API) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload: "+err.Error())
		return
	}
	email := auth.NormalizeEmail(req.Email)
	if email == "" || !strings.Contains(email, "@") {
		writeError(w, http.StatusBadRequest, "valid email is required")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash password failed")
		return
	}

	u, err := a.store.CreateUser(email, strings.TrimSpace(req.Name), hash)
	if err != nil {
		writeError(w, http.StatusConflict, "user with this email already exists")
		return
	}

	token, err := a.auth.Issue(u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue token")
		return
	}

	writeJSON(w, http.StatusCreated, models.AuthResponse{Token: token, User: u})
}

func (a *API) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload")
		return
	}
	email := auth.NormalizeEmail(req.Email)
	u, err := a.store.UserByEmail(email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if !auth.CheckPassword(u.PasswordHash, req.Password) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := a.auth.Issue(u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue token")
		return
	}

	writeJSON(w, http.StatusOK, models.AuthResponse{Token: token, User: u})
}

func (a *API) handleMe(w http.ResponseWriter, r *http.Request) {
	userID := userIDFrom(r.Context())
	u, err := a.store.UserByID(userID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, u)
}
