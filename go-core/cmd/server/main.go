package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"beone/go-core/internal/config"
	corehttp "beone/go-core/internal/http"
	"beone/go-core/internal/service"
	"beone/go-core/internal/store"
	"beone/go-core/internal/ws"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	_, _ = store.NewPostgres(ctx, cfg)
	_ = store.NewRedis(cfg)
	minioClient, _ := store.NewMinio(cfg)

	uploadSvc := service.NewUploadService(cfg, minioClient)
	convSvc := service.NewConversationService()
	fileSvc := service.NewFileService("uploads")
	hub := ws.NewHub()
	router := corehttp.NewRouter(cfg, uploadSvc, convSvc, fileSvc, hub)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("go-core listening on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		panic(err)
	}
}
