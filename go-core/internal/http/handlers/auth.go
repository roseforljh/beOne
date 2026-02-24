package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"beone/go-core/internal/auth"
	"beone/go-core/internal/config"
	"beone/go-core/internal/domain"
	"beone/go-core/internal/http/middleware"
	"github.com/go-chi/chi/v5"
)

type AuthHandler struct {
	cfg    config.Config
	client *http.Client
}

func NewAuthHandler(cfg config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg, client: &http.Client{Timeout: 15 * time.Second}}
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

func (h *AuthHandler) OAuthLogin(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	cfgID, _, ok := h.providerCreds(provider)
	if !ok {
		http.Error(w, "unsupported provider", http.StatusBadRequest)
		return
	}
	if cfgID == "" {
		http.Error(w, "oauth provider not configured", http.StatusServiceUnavailable)
		return
	}

	state, err := randomState()
	if err != nil {
		http.Error(w, "failed to create oauth state", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecureRequest(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_provider",
		Value:    provider,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecureRequest(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})

	http.Redirect(w, r, h.providerAuthURL(provider, cfgID, state, h.oauthCallbackURL(provider, r)), http.StatusFound)
}

func (h *AuthHandler) OAuthCallback(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	clientID, clientSecret, ok := h.providerCreds(provider)
	if !ok {
		http.Error(w, "unsupported provider", http.StatusBadRequest)
		return
	}
	if clientID == "" || clientSecret == "" {
		http.Error(w, "oauth provider not configured", http.StatusServiceUnavailable)
		return
	}

	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if state == "" || code == "" {
		http.Error(w, "invalid oauth callback", http.StatusBadRequest)
		return
	}

	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value == "" || stateCookie.Value != state {
		http.Error(w, "invalid oauth state", http.StatusBadRequest)
		return
	}
	providerCookie, err := r.Cookie("oauth_provider")
	if err != nil || providerCookie.Value != provider {
		http.Error(w, "invalid oauth provider", http.StatusBadRequest)
		return
	}

	http.SetCookie(w, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: isSecureRequest(r), SameSite: http.SameSiteLaxMode})
	http.SetCookie(w, &http.Cookie{Name: "oauth_provider", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: isSecureRequest(r), SameSite: http.SameSiteLaxMode})

	accessToken, err := h.exchangeCode(provider, code, h.oauthCallbackURL(provider, r), clientID, clientSecret)
	if err != nil {
		http.Error(w, "oauth token exchange failed", http.StatusUnauthorized)
		return
	}

	user, err := h.fetchOAuthUser(provider, accessToken)
	if err != nil {
		http.Error(w, "oauth user fetch failed", http.StatusUnauthorized)
		return
	}

	jwtToken, err := auth.GenerateToken(h.cfg.JWTSecret, user.ID, user.Username, h.cfg.JWTTTL)
	if err != nil {
		http.Error(w, "failed to issue token", http.StatusInternalServerError)
		return
	}

	redirectURL := fmt.Sprintf("%s/login?token=%s&provider=%s", h.frontendBaseURL(r), url.QueryEscape(jwtToken), url.QueryEscape(provider))
	http.Redirect(w, r, redirectURL, http.StatusFound)
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

func (h *AuthHandler) providerCreds(provider string) (string, string, bool) {
	switch strings.ToLower(provider) {
	case "github":
		return h.cfg.GithubClientID, h.cfg.GithubClientSecret, true
	case "google":
		return h.cfg.GoogleClientID, h.cfg.GoogleClientSecret, true
	default:
		return "", "", false
	}
}

func (h *AuthHandler) oauthCallbackURL(provider string, r *http.Request) string {
	base := strings.TrimRight(h.cfg.PublicBaseURL, "/")
	if base == "" {
		scheme := "http"
		if isSecureRequest(r) {
			scheme = "https"
		}
		base = fmt.Sprintf("%s://%s", scheme, r.Host)
	}
	return fmt.Sprintf("%s/api/v1/auth/oauth/%s/callback", base, url.PathEscape(provider))
}

func (h *AuthHandler) frontendBaseURL(r *http.Request) string {
	base := strings.TrimRight(h.cfg.FrontendURL, "/")
	if base != "" {
		return base
	}
	scheme := "http"
	if isSecureRequest(r) {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s", scheme, r.Host)
}

func (h *AuthHandler) providerAuthURL(provider, clientID, state, redirectURI string) string {
	if provider == "google" {
		q := url.Values{}
		q.Set("client_id", clientID)
		q.Set("redirect_uri", redirectURI)
		q.Set("response_type", "code")
		q.Set("scope", "openid email profile")
		q.Set("state", state)
		q.Set("access_type", "online")
		q.Set("prompt", "select_account")
		return "https://accounts.google.com/o/oauth2/v2/auth?" + q.Encode()
	}

	q := url.Values{}
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("scope", "read:user user:email")
	q.Set("state", state)
	return "https://github.com/login/oauth/authorize?" + q.Encode()
}

func (h *AuthHandler) exchangeCode(provider, code, redirectURI, clientID, clientSecret string) (string, error) {
	if provider == "google" {
		form := url.Values{}
		form.Set("code", code)
		form.Set("client_id", clientID)
		form.Set("client_secret", clientSecret)
		form.Set("redirect_uri", redirectURI)
		form.Set("grant_type", "authorization_code")

		req, _ := http.NewRequest(http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		resp, err := h.client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return "", fmt.Errorf("google token status %d", resp.StatusCode)
		}
		var body struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return "", err
		}
		if body.AccessToken == "" {
			return "", fmt.Errorf("empty google access token")
		}
		return body.AccessToken, nil
	}

	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("redirect_uri", redirectURI)

	req, _ := http.NewRequest(http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := h.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("github token status %d", resp.StatusCode)
	}
	var body struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	if body.AccessToken == "" {
		return "", fmt.Errorf("empty github access token")
	}
	return body.AccessToken, nil
}

func (h *AuthHandler) fetchOAuthUser(provider, accessToken string) (domain.User, error) {
	if provider == "google" {
		req, _ := http.NewRequest(http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		resp, err := h.client.Do(req)
		if err != nil {
			return domain.User{}, err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			b, _ := io.ReadAll(resp.Body)
			return domain.User{}, fmt.Errorf("google user status %d: %s", resp.StatusCode, string(b))
		}
		var body struct {
			Sub   string `json:"sub"`
			Email string `json:"email"`
			Name  string `json:"name"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return domain.User{}, err
		}
		username := body.Name
		if username == "" && body.Email != "" {
			username = strings.Split(body.Email, "@")[0]
		}
		if username == "" {
			username = "google_user"
		}
		return domain.User{ID: stableUserID("google", body.Sub), Username: username, Email: body.Email}, nil
	}

	req, _ := http.NewRequest(http.MethodGet, "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := h.client.Do(req)
	if err != nil {
		return domain.User{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return domain.User{}, fmt.Errorf("github user status %d: %s", resp.StatusCode, string(b))
	}
	var body struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return domain.User{}, err
	}
	email := body.Email
	if email == "" {
		email = h.fetchGithubEmail(accessToken)
	}
	username := body.Login
	if username == "" {
		username = body.Name
	}
	if username == "" {
		username = "github_user"
	}
	return domain.User{ID: stableUserID("github", fmt.Sprintf("%d", body.ID)), Username: username, Email: email}, nil
}

func (h *AuthHandler) fetchGithubEmail(accessToken string) string {
	req, _ := http.NewRequest(http.MethodGet, "https://api.github.com/user/emails", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := h.client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ""
	}
	var emails []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return ""
	}
	for _, e := range emails {
		if e.Primary {
			return e.Email
		}
	}
	if len(emails) > 0 {
		return emails[0].Email
	}
	return ""
}

func randomState() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func stableUserID(provider, sub string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(provider + ":" + sub))
	id := int64(h.Sum64() & 0x7fffffffffffffff)
	if id == 0 {
		return 1
	}
	return id
}

func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}
