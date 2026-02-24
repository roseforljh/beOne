package handlers

import (
	"encoding/json"
	"net/http"

	"beone/go-core/internal/domain"
	"beone/go-core/internal/http/middleware"
	"beone/go-core/internal/service"
	"github.com/go-chi/chi/v5"
)

type ConversationHandler struct {
	svc *service.ConversationService
}

func NewConversationHandler(svc *service.ConversationService) *ConversationHandler {
	return &ConversationHandler{svc: svc}
}

func (h *ConversationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	_ = json.NewEncoder(w).Encode(h.svc.List(claims.UserID))
}

func (h *ConversationHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	var req struct{ Title string `json:"title"` }
	_ = json.NewDecoder(r.Body).Decode(&req)
	c := h.svc.Create(claims.UserID, req.Title)
	_ = json.NewEncoder(w).Encode(c)
}

func (h *ConversationHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	c, ok := h.svc.Get(id)
	if !ok { http.Error(w, "not found", http.StatusNotFound); return }
	_ = json.NewEncoder(w).Encode(c)
}

func (h *ConversationHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct{ Title string `json:"title"` }
	_ = json.NewDecoder(r.Body).Decode(&req)
	c, ok := h.svc.Update(id, req.Title)
	if !ok { http.Error(w, "not found", http.StatusNotFound); return }
	_ = json.NewEncoder(w).Encode(c)
}

func (h *ConversationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.svc.Delete(id) { http.Error(w, "not found", http.StatusNotFound); return }
	w.WriteHeader(http.StatusNoContent)
}

func (h *ConversationHandler) Clear(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.svc.Clear(id) { http.Error(w, "not found", http.StatusNotFound); return }
	w.WriteHeader(http.StatusNoContent)
}

func (h *ConversationHandler) AddMessage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req domain.ConversationMessage
	_ = json.NewDecoder(r.Body).Decode(&req)
	m, ok := h.svc.AddMessage(id, req)
	if !ok { http.Error(w, "not found", http.StatusNotFound); return }
	_ = json.NewEncoder(w).Encode(m)
}

func (h *ConversationHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	msgs, ok := h.svc.Messages(id)
	if !ok { http.Error(w, "not found", http.StatusNotFound); return }
	_ = json.NewEncoder(w).Encode(msgs)
}
