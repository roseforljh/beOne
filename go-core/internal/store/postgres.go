package store

import (
	"context"
	"time"

	"beone/go-core/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgres(ctx context.Context, cfg config.Config) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return pgxpool.New(ctx, cfg.DatabaseURL)
}
