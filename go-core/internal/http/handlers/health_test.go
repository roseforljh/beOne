package handlers_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"beone/go-core/internal/config"
	corehttp "beone/go-core/internal/http"
	"beone/go-core/internal/service"
	"beone/go-core/internal/ws"
)

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	cfg := config.Load()
	router := corehttp.NewRouter(cfg, service.NewUploadService(cfg, nil), service.NewConversationService(), service.NewFileService("uploads-test"), ws.NewHub())
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}
