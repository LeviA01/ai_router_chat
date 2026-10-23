package httpapi

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"ai-chat/internal/ai"
	"ai-chat/internal/models"
	"ai-chat/internal/store"
	"github.com/go-chi/chi/v5"
)

func (a *API) handleListChats(w http.ResponseWriter, r *http.Request) {
	userID := userIDFrom(r.Context())
	chats, err := a.store.ListChats(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, chats)
}

func (a *API) handleGetChat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := userIDFrom(r.Context())
	chat, err := a.store.ChatByID(userID, id)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "chat not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, chat)
}

type chatReq struct {
	Title      string `json:"title"`
	ProviderID string `json:"provider_id"`
	Model      string `json:"model"`
}

func (a *API) handleCreateChat(w http.ResponseWriter, r *http.Request) {
	var req chatReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	userID := userIDFrom(r.Context())
	c := models.Chat{
		Title:      req.Title,
		ProviderID: req.ProviderID,
		Model:      req.Model,
	}

	created, err := a.store.CreateChat(userID, c)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func (a *API) handleUpdateChat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req chatReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	userID := userIDFrom(r.Context())
	chat, err := a.store.ChatByID(userID, id)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "chat not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	if req.Title != "" {
		chat.Title = req.Title
	}
	if req.ProviderID != "" {
		chat.ProviderID = req.ProviderID
	}
	if req.Model != "" {
		chat.Model = req.Model
	}

	if err := a.store.UpdateChat(userID, chat); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, chat)
}

func (a *API) handleDeleteChat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := userIDFrom(r.Context())
	if err := a.store.DeleteChat(userID, id); err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "chat not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleListMessages(w http.ResponseWriter, r *http.Request) {
	chatID := chi.URLParam(r, "id")
	userID := userIDFrom(r.Context())
	msgs, err := a.store.ListMessages(userID, chatID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "chat not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, msgs)
}

type sendReq struct {
	Content string `json:"content"`
}

func (a *API) handleSendMessage(w http.ResponseWriter, r *http.Request) {
	chatID := chi.URLParam(r, "id")
	userID := userIDFrom(r.Context())

	var req sendReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	chat, err := a.store.ChatByID(userID, chatID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "chat not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	if chat.ProviderID == "" || chat.Model == "" {
		writeError(w, http.StatusBadRequest, "chat has no provider or model selected")
		return
	}

	provider, err := a.store.ProviderByID(userID, chat.ProviderID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "provider not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	if provider.APIKey == "" {
		writeError(w, http.StatusBadRequest, "provider has no API key")
		return
	}

	userMsg, err := a.store.AddMessage(chatID, "user", req.Content)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save message")
		return
	}

	history, err := a.store.ListMessages(userID, chatID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load history")
		return
	}

	apiHistory := make([]ai.ChatMessage, 0, len(history))
	for _, m := range history {
		apiHistory = append(apiHistory, ai.ChatMessage{Role: m.Role, Content: m.Content})
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		log.Println("streaming not supported")
		return
	}

	sendSSE := func(event, data string) {
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
		flusher.Flush()
	}

	sendSSE("message", fmt.Sprintf(`{"id":"%s","chat_id":"%s","role":"user","content":%q}`, userMsg.ID, userMsg.ChatID, userMsg.Content))

	assistantContent := strings.Builder{}
	client := ai.NewClient(provider.BaseURL, provider.APIKey)
	err = client.StreamChat(r.Context(), chat.Model, apiHistory, func(token string) error {
		assistantContent.WriteString(token)
		sendSSE("token", token)
		return nil
	})

	if err != nil {
		log.Printf("stream error: %v", err)
		sendSSE("error", err.Error())
		return
	}

	assistantMsg, err := a.store.AddMessage(chatID, "assistant", assistantContent.String())
	if err != nil {
		log.Printf("save assistant msg: %v", err)
		sendSSE("error", "failed to save response")
		return
	}

	if err := a.store.TouchChat(userID, chatID); err != nil {
		log.Printf("touch chat: %v", err)
	}

	sendSSE("done", fmt.Sprintf(`{"id":"%s"}`, assistantMsg.ID))
}
