package domain

import "time"

type ConversationMessage struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	Type           string    `json:"type"`
	Content        string    `json:"content,omitempty"`
	Filename       string    `json:"filename,omitempty"`
	FileID         string    `json:"file_id,omitempty"`
	MimeType       string    `json:"mime_type,omitempty"`
	DeviceName     string    `json:"device_name"`
	CreatedAt      time.Time `json:"created_at"`
}

type Conversation struct {
	ID        string                `json:"id"`
	UserID    int64                 `json:"user_id"`
	Title     string                `json:"title"`
	CreatedAt time.Time             `json:"created_at"`
	UpdatedAt time.Time             `json:"updated_at"`
	Messages  []ConversationMessage `json:"messages,omitempty"`
}
