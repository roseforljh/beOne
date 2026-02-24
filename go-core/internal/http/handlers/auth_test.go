package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"beone/go-core/internal/config"
	corehttp "beone/go-core/internal/http"
	"beone/go-core/internal/service"
	"beone/go-core/internal/ws"
)

func TestDevLoginAndMe(t *testing.T) {
	cfg := config.Load()
	router := corehttp.NewRouter(cfg, service.NewUploadService(cfg, nil), service.NewConversationService(), service.NewFileService("uploads-test"), ws.NewHub())

	loginBody := []byte(`{"username":"dev_user"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/dev-login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	router.ServeHTTP(loginRR, loginReq)

	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d", loginRR.Code)
	}

	var loginResp map[string]any
	if err := json.Unmarshal(loginRR.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("failed to parse login response: %v", err)
	}
	token, _ := loginResp["access_token"].(string)
	if token == "" {
		t.Fatal("expected access_token")
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+token)
	meRR := httptest.NewRecorder()
	router.ServeHTTP(meRR, meReq)

	if meRR.Code != http.StatusOK {
		t.Fatalf("expected me 200, got %d", meRR.Code)
	}
}

func TestMeUnauthorized(t *testing.T) {
	cfg := config.Load()
	router := corehttp.NewRouter(cfg, service.NewUploadService(cfg, nil), service.NewConversationService(), service.NewFileService("uploads-test"), ws.NewHub())

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}
