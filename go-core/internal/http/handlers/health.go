package handlers

import (
	"net/http"

	"github.com/go-chi/render"
)

type healthResponse struct {
	Status string `json:"status"`
}

func Health(w http.ResponseWriter, r *http.Request) {
	render.Status(r, http.StatusOK)
	render.JSON(w, r, healthResponse{Status: "ok"})
}
