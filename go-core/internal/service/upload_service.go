package service

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"

	"beone/go-core/internal/config"
	"github.com/minio/minio-go/v7"
)

type UploadService struct {
	cfg    config.Config
	minio  *minio.Client
	mu     sync.Mutex
	parts  map[string]map[int][]byte
}

func NewUploadService(cfg config.Config, minioClient *minio.Client) *UploadService {
	return &UploadService{cfg: cfg, minio: minioClient, parts: make(map[string]map[int][]byte)}
}

func (s *UploadService) SavePart(uploadID, partNumber string, data []byte) error {
	n, err := strconv.Atoi(partNumber)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.parts[uploadID]; !ok {
		s.parts[uploadID] = make(map[int][]byte)
	}
	s.parts[uploadID][n] = data
	return nil
}

func (s *UploadService) Complete(uploadID, filename, mimeType string) (string, int64, error) {
	s.mu.Lock()
	parts, ok := s.parts[uploadID]
	if !ok {
		s.mu.Unlock()
		return "", 0, fmt.Errorf("upload not found")
	}
	delete(s.parts, uploadID)
	s.mu.Unlock()

	keys := make([]int, 0, len(parts))
	for k := range parts {
		keys = append(keys, k)
	}
	sort.Ints(keys)

	var merged bytes.Buffer
	for _, k := range keys {
		merged.Write(parts[k])
	}

	objectKey := fmt.Sprintf("uploads/%s_%s", uploadID, filepath.Base(filename))

	if s.minio == nil {
		if err := os.MkdirAll("uploads", 0o755); err != nil {
			return "", 0, err
		}
		if err := os.WriteFile(filepath.Join("uploads", uploadID+"_"+filepath.Base(filename)), merged.Bytes(), 0o644); err != nil {
			return "", 0, err
		}
		return objectKey, int64(merged.Len()), nil
	}

	_, err := s.minio.PutObject(context.Background(), s.cfg.MinioBucket, objectKey, bytes.NewReader(merged.Bytes()), int64(merged.Len()), minio.PutObjectOptions{ContentType: mimeType})
	if err != nil {
		return "", 0, err
	}

	return objectKey, int64(merged.Len()), nil
}
