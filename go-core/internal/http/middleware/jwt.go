package middleware

import (
	"context"
	"net/http"
	"strings"

	"beone/go-core/internal/auth"
)

type ContextKey string

const UserClaimsKey ContextKey = "user_claims"

func JWT(secret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authz := r.Header.Get("Authorization")
		if authz == "" || !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		raw := strings.TrimSpace(authz[len("Bearer "):])
		claims, err := auth.ParseToken(secret, raw)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ClaimsFromContext(ctx context.Context) (*auth.Claims, bool) {
	claims, ok := ctx.Value(UserClaimsKey).(*auth.Claims)
	return claims, ok
}
