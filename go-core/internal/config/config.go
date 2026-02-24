package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port         string
	DatabaseURL  string
	RedisAddr    string
	MinioEndpoint string
	MinioAccessKey string
	MinioSecretKey string
	MinioBucket  string
	MinioSecure  bool
	JWTSecret    string
	JWTTTL       time.Duration
}

func Load() Config {
	port := getenv("GO_CORE_PORT", "8080")
	jwtTTLMinutes, _ := strconv.Atoi(getenv("JWT_TTL_MINUTES", "10080"))
	minioSecure, _ := strconv.ParseBool(getenv("MINIO_SECURE", "false"))

	return Config{
		Port:           port,
		DatabaseURL:    getenv("DATABASE_URL", "postgres://synchub:synchub123@postgres:5432/synchub?sslmode=disable"),
		RedisAddr:      getenv("REDIS_ADDR", "redis:6379"),
		MinioEndpoint:  getenv("MINIO_ENDPOINT", "minio:9000"),
		MinioAccessKey: getenv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey: getenv("MINIO_SECRET_KEY", "minioadmin"),
		MinioBucket:    getenv("MINIO_BUCKET", "synchub"),
		MinioSecure:    minioSecure,
		JWTSecret:      getenv("JWT_SECRET", "dev-jwt-secret-change-me"),
		JWTTTL:         time.Duration(jwtTTLMinutes) * time.Minute,
	}
}

func getenv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
