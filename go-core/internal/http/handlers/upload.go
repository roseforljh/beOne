package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"beone/go-core/internal/domain"
	"beone/go-core/internal/service"
	"github.com/google/uuid"
)

type UploadHandler struct {
	svc *service.UploadService
}

func NewUploadHandler(svc *service.UploadService) *UploadHandler {
	return &UploadHandler{svc: svc}
}

type initUploadRequest struct {
	Filename string `json:"filename"`
	MimeType string `json:"mime_type"`
}

type initUploadResponse struct {
	UploadID string `json:"upload_id"`
}

var uploadState sync.Map

func (h *UploadHandler) InitChunkUpload(w http.ResponseWriter, r *http.Request) {
	var req initUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Filename == "" {
		http.Error(w, "filename required", http.StatusBadRequest)
		return
	}

	uploadID := uuid.NewString()
	uploadState.Store(uploadID, req)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(initUploadResponse{UploadID: uploadID})
}

func (h *UploadHandler) UploadPart(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimSpace(r.URL.Query().Get("upload_id"))
	if uploadID == "" {
		http.Error(w, "upload_id required", http.StatusBadRequest)
		return
	}
	partNumber := r.URL.Query().Get("part_number")
	if _, err := strconv.Atoi(partNumber); err != nil {
		http.Error(w, "invalid part_number", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read part", http.StatusBadRequest)
		return
	}

	if err := h.svc.SavePart(uploadID, partNumber, body); err != nil {
		http.Error(w, "failed to save part", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *UploadHandler) CompleteChunkUpload(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimSpace(r.URL.Query().Get("upload_id"))
	if uploadID == "" {
		http.Error(w, "upload_id required", http.StatusBadRequest)
		return
	}

	stateRaw, ok := uploadState.Load(uploadID)
	if !ok {
		http.Error(w, "upload not found", http.StatusNotFound)
		return
	}
	state := stateRaw.(initUploadRequest)

	objectKey, size, err := h.svc.Complete(uploadID, filepath.Base(state.Filename), state.MimeType)
	if err != nil {
		http.Error(w, "failed to complete upload", http.StatusInternalServerError)
		return
	}

	file := domain.File{
		ID:          uploadID,
		Filename:    state.Filename,
		MimeType:    state.MimeType,
		Size:        size,
		CreatedAt:   time.Now(),
		DownloadURL: "/api/v1/files/download/" + objectKey,
	}

	uploadState.Delete(uploadID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"file": file})
}
