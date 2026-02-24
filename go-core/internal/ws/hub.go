package ws

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
}

type outboundMessage struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
}

func NewHub() *Hub {
	return &Hub{clients: make(map[*Client]struct{})}
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = struct{}{}
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
}

func (h *Hub) Broadcast(msg outboundMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		_ = c.conn.WriteJSON(msg)
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "upgrade failed", http.StatusBadRequest)
		return
	}

	client := &Client{conn: conn, hub: h}
	h.Register(client)

	_ = conn.WriteJSON(outboundMessage{Type: "connected"})
	_ = conn.SetReadDeadline(time.Now().Add(90 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(90 * time.Second))
		return nil
	})

	for {
		var incoming map[string]any
		if err := conn.ReadJSON(&incoming); err != nil {
			break
		}

		if typ, _ := incoming["type"].(string); typ == "ping" {
			_ = conn.WriteJSON(outboundMessage{Type: "pong"})
			continue
		}

		content, _ := incoming["content"].(string)
		payload, _ := json.Marshal(outboundMessage{Type: "message", Content: content})
		_ = conn.WriteMessage(websocket.TextMessage, payload)
	}

	h.Unregister(client)
	_ = conn.Close()
}
