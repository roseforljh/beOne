package handlers

import (
	"encoding/json"
	"net/http"

	"beone/go-core/internal/auth"
	"beone/go-core/internal/config"
	"beone/go-core/internal/domain"
	"beone/go-core/internal/http/middleware"
)

type AuthHandler struct {
	cfg config.Config
}

func NewAuthHandler(cfg config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

type devLoginRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
}

type devLoginResponse struct {
	AccessToken string      `json:"access_token"`
	User        domain.User `json:"user"`
}

func (h *AuthHandler) DevLogin(w http.ResponseWriter, r *http.Request) {
	var req devLoginRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Username == "" {
		req.Username = "dev_user"
	}
	if req.Email == "" {
		req.Email = "dev@example.com"
	}

	user := domain.User{ID: 1, Username: req.Username, Email: req.Email}
	token, err := auth.GenerateToken(h.cfg.JWTSecret, user.ID, user.Username, h.cfg.JWTTTL)
	if err != nil {
		http.Error(w, "failed to issue token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(devLoginResponse{AccessToken: token, User: user})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(domain.User{ID: claims.UserID, Username: claims.Username, Email: claims.Username + "@example.com"})
}
