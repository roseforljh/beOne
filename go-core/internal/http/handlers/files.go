package handlers

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"

	"beone/go-core/internal/service"
	"github.com/go-chi/chi/v5"
)

type FilesHandler struct {
	svc *service.FileService
}

func NewFilesHandler(svc *service.FileService) *FilesHandler {
	return &FilesHandler{svc: svc}
}

func (h *FilesHandler) Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, "invalid multipart", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = mime.TypeByExtension(filepath.Ext(header.Filename))
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	rec, err := h.svc.Save(header.Filename, mimeType, file)
	if err != nil {
		http.Error(w, "save failed", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"file": rec})
}

func (h *FilesHandler) Download(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rec, path, ok := h.svc.Get(id)
	if !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", rec.MimeType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+rec.Filename+"\"")
	_, _ = io.Copy(w, f)
}

func (h *FilesHandler) List(w http.ResponseWriter, r *http.Request) {
	_ = json.NewEncoder(w).Encode(h.svc.List())
}
