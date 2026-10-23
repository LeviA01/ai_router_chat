package httpapi

import (
	"log"
	"net/http"

	"ai-chat/internal/ai"
	"ai-chat/internal/models"
	"ai-chat/internal/store"
	"github.com/go-chi/chi/v5"
)

func (a *API) handleListProviders(w http.ResponseWriter, r *http.Request) {
	userID := userIDFrom(r.Context())
	list, err := a.store.ListProviders(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	for i := range list {
		list[i].APIKey = ""
	}
	writeJSON(w, http.StatusOK, list)
}

type createProviderReq struct {
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
	Kind    string `json:"kind"`
}

func (a *API) handleCreateProvider(w http.ResponseWriter, r *http.Request) {
	var req createProviderReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload")
		return
	}
	if req.Name == "" || req.BaseURL == "" {
		writeError(w, http.StatusBadRequest, "name and base_url required")
		return
	}

	userID := userIDFrom(r.Context())
	p := models.Provider{
		UserID:  userID,
		Name:    req.Name,
		BaseURL: req.BaseURL,
		APIKey:  req.APIKey,
		Kind:    req.Kind,
	}

	created, err := a.store.CreateProvider(p)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	created.APIKey = ""
	writeJSON(w, http.StatusCreated, created)
}

func (a *API) handleUpdateProvider(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req createProviderReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload")
		return
	}

	userID := userIDFrom(r.Context())
	p, err := a.store.ProviderByID(userID, id)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "provider not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	if req.Name != "" {
		p.Name = req.Name
	}
	if req.BaseURL != "" {
		p.BaseURL = req.BaseURL
	}
	if req.APIKey != "" {
		p.APIKey = req.APIKey
	}
	if req.Kind != "" {
		p.Kind = req.Kind
	}

	if err := a.store.UpdateProvider(p); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	p.APIKey = ""
	writeJSON(w, http.StatusOK, p)
}

func (a *API) handleDeleteProvider(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := userIDFrom(r.Context())
	if err := a.store.DeleteProvider(userID, id); err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "provider not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleRefreshModels(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := userIDFrom(r.Context())

	p, err := a.store.ProviderByID(userID, id)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "provider not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	if p.APIKey == "" {
		writeError(w, http.StatusBadRequest, "provider has no API key")
		return
	}

	client := ai.NewClient(p.BaseURL, p.APIKey)
	models, err := client.FetchModels(r.Context())
	if err != nil {
		log.Printf("fetch models: %v", err)
		writeError(w, http.StatusBadGateway, "failed to fetch models: "+err.Error())
		return
	}

	p.Models = models
	if err := a.store.UpdateProvider(p); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	p.APIKey = ""
	writeJSON(w, http.StatusOK, p)
}
