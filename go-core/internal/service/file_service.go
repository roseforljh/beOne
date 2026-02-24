package service

import (
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"beone/go-core/internal/domain"
	"github.com/google/uuid"
)

type FileService struct {
	mu      sync.RWMutex
	files   map[string]domain.File
	storage string
}

func NewFileService(storage string) *FileService {
	if storage == "" {
		storage = "uploads"
	}
	_ = os.MkdirAll(storage, 0o755)
	return &FileService{files: make(map[string]domain.File), storage: storage}
}

func (s *FileService) Save(filename, mimeType string, src io.Reader) (domain.File, error) {
	id := uuid.NewString()
	object := id + "_" + filepath.Base(filename)
	path := filepath.Join(s.storage, object)

	f, err := os.Create(path)
	if err != nil {
		return domain.File{}, err
	}
	size, err := io.Copy(f, src)
	_ = f.Close()
	if err != nil {
		return domain.File{}, err
	}

	rec := domain.File{ID: id, Filename: filename, MimeType: mimeType, Size: size, CreatedAt: time.Now(), DownloadURL: "/api/v1/files/" + id}
	s.mu.Lock()
	s.files[id] = rec
	s.mu.Unlock()
	return rec, nil
}

func (s *FileService) Get(id string) (domain.File, string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	f, ok := s.files[id]
	if !ok {
		return domain.File{}, "", false
	}
	path := filepath.Join(s.storage, f.ID+"_"+filepath.Base(f.Filename))
	return f, path, true
}

func (s *FileService) List() []domain.File {
	s.mu.RLock()
	defer s.mu.RUnlock()
	res := make([]domain.File, 0, len(s.files))
	for _, f := range s.files {
		res = append(res, f)
	}
	return res
}
