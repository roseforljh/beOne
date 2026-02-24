package http

import (
	"net/http"

	"beone/go-core/internal/config"
	"beone/go-core/internal/http/handlers"
	"beone/go-core/internal/http/middleware"
	"beone/go-core/internal/service"
	"beone/go-core/internal/ws"
	"github.com/go-chi/chi/v5"
)

func NewRouter(cfg config.Config, uploadSvc *service.UploadService, convSvc *service.ConversationService, fileSvc *service.FileService, hub *ws.Hub) http.Handler {
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	authHandler := handlers.NewAuthHandler(cfg)
	uploadHandler := handlers.NewUploadHandler(uploadSvc)
	convHandler := handlers.NewConversationHandler(convSvc)
	filesHandler := handlers.NewFilesHandler(fileSvc)

	r.Get("/health", handlers.Health)
	r.Post("/api/v1/auth/dev-login", authHandler.DevLogin)
	r.Get("/api/v1/auth/oauth/{provider}/login", authHandler.OAuthLogin)
	r.Get("/api/v1/auth/oauth/{provider}/callback", authHandler.OAuthCallback)
	r.Get("/ws/{clientID}", hub.HandleWS)

	r.Group(func(pr chi.Router) {
		pr.Use(func(next http.Handler) http.Handler { return middleware.JWT(cfg.JWTSecret, next) })
		pr.Get("/api/v1/auth/me", authHandler.Me)
		pr.Post("/api/v1/files/upload/init", uploadHandler.InitChunkUpload)
		pr.Post("/api/v1/files/upload/part", uploadHandler.UploadPart)
		pr.Post("/api/v1/files/upload/complete", uploadHandler.CompleteChunkUpload)

		pr.Post("/api/v1/files/upload", filesHandler.Upload)
		pr.Get("/api/v1/files", filesHandler.List)
		pr.Get("/api/v1/files/{id}", filesHandler.Download)

		pr.Get("/api/v1/conversations", convHandler.List)
		pr.Post("/api/v1/conversations", convHandler.Create)
		pr.Get("/api/v1/conversations/{id}", convHandler.Get)
		pr.Patch("/api/v1/conversations/{id}", convHandler.Update)
		pr.Delete("/api/v1/conversations/{id}", convHandler.Delete)
		pr.Post("/api/v1/conversations/{id}/clear", convHandler.Clear)
		pr.Post("/api/v1/conversations/{id}/messages", convHandler.AddMessage)
		pr.Get("/api/v1/conversations/{id}/messages", convHandler.GetMessages)
	})

	return r
}
