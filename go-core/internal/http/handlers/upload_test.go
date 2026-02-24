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

func TestChunkUploadFlow(t *testing.T) {
	cfg := config.Load()
	router := corehttp.NewRouter(cfg, service.NewUploadService(cfg, nil), service.NewConversationService(), service.NewFileService("uploads-test"), ws.NewHub())

	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/dev-login", bytes.NewReader([]byte(`{"username":"dev_user"}`)))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	router.ServeHTTP(loginRR, loginReq)
	var loginResp map[string]any
	_ = json.Unmarshal(loginRR.Body.Bytes(), &loginResp)
	token, _ := loginResp["access_token"].(string)
	if token == "" {
		t.Fatal("expected token")
	}

	initReq := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload/init", bytes.NewReader([]byte(`{"filename":"a.txt","mime_type":"text/plain"}`)))
	initReq.Header.Set("Authorization", "Bearer "+token)
	initReq.Header.Set("Content-Type", "application/json")
	initRR := httptest.NewRecorder()
	router.ServeHTTP(initRR, initReq)
	if initRR.Code != http.StatusOK {
		t.Fatalf("expected init 200, got %d", initRR.Code)
	}

	var initResp map[string]any
	_ = json.Unmarshal(initRR.Body.Bytes(), &initResp)
	uploadID, _ := initResp["upload_id"].(string)
	if uploadID == "" {
		t.Fatal("expected upload_id")
	}

	partReq := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload/part?upload_id="+uploadID+"&part_number=1", bytes.NewReader([]byte("hello")))
	partReq.Header.Set("Authorization", "Bearer "+token)
	partRR := httptest.NewRecorder()
	router.ServeHTTP(partRR, partReq)
	if partRR.Code != http.StatusNoContent {
		t.Fatalf("expected part 204, got %d", partRR.Code)
	}

	completeReq := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload/complete?upload_id="+uploadID, nil)
	completeReq.Header.Set("Authorization", "Bearer "+token)
	completeRR := httptest.NewRecorder()
	router.ServeHTTP(completeRR, completeReq)
	if completeRR.Code != http.StatusOK {
		t.Fatalf("expected complete 200, got %d", completeRR.Code)
	}
}
