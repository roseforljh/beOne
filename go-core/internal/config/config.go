package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port               string
	PublicBaseURL      string
	FrontendURL        string
	DatabaseURL        string
	RedisAddr          string
	MinioEndpoint      string
	MinioAccessKey     string
	MinioSecretKey     string
	MinioBucket        string
	MinioSecure        bool
	JWTSecret          string
	JWTTTL             time.Duration
	GithubClientID     string
	GithubClientSecret string
	GoogleClientID     string
	GoogleClientSecret string
}

func Load() Config {
	port := getenv("GO_CORE_PORT", "8080")
	jwtTTLMinutes, _ := strconv.Atoi(getenv("JWT_TTL_MINUTES", "10080"))
	minioSecure, _ := strconv.ParseBool(getenv("MINIO_SECURE", "false"))

	return Config{
		Port:               port,
		PublicBaseURL:      getenv("GO_CORE_PUBLIC_URL", ""),
		FrontendURL:        getenv("FRONTEND_URL", ""),
		DatabaseURL:        getenv("DATABASE_URL", "postgres://synchub:synchub123@postgres:5432/synchub?sslmode=disable"),
		RedisAddr:          getenv("REDIS_ADDR", "redis:6379"),
		MinioEndpoint:      getenv("MINIO_ENDPOINT", "minio:9000"),
		MinioAccessKey:     getenv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey:     getenv("MINIO_SECRET_KEY", "minioadmin"),
		MinioBucket:        getenv("MINIO_BUCKET", "synchub"),
		MinioSecure:        minioSecure,
		JWTSecret:          getenv("JWT_SECRET", "dev-jwt-secret-change-me"),
		JWTTTL:             time.Duration(jwtTTLMinutes) * time.Minute,
		GithubClientID:     getenv("GITHUB_CLIENT_ID", ""),
		GithubClientSecret: getenv("GITHUB_CLIENT_SECRET", ""),
		GoogleClientID:     getenv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getenv("GOOGLE_CLIENT_SECRET", ""),
	}
}

func getenv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
