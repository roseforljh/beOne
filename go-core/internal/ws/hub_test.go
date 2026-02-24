package ws_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"beone/go-core/internal/ws"
	"github.com/gorilla/websocket"
)

func TestHubConnectedAndPingPong(t *testing.T) {
	hub := ws.NewHub()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub.HandleWS(w, r)
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws/test"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()

	var connected map[string]any
	if err := conn.ReadJSON(&connected); err != nil {
		t.Fatalf("read connected failed: %v", err)
	}
	if connected["type"] != "connected" {
		t.Fatalf("expected connected message")
	}

	if err := conn.WriteJSON(map[string]any{"type": "ping"}); err != nil {
		t.Fatalf("write ping failed: %v", err)
	}

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var pong map[string]any
	if err := conn.ReadJSON(&pong); err != nil {
		t.Fatalf("read pong failed: %v", err)
	}
	if pong["type"] != "pong" {
		t.Fatalf("expected pong")
	}
}
