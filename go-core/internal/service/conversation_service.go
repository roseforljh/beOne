package service

import (
	"sort"
	"sync"
	"time"

	"beone/go-core/internal/domain"
	"github.com/google/uuid"
)

type ConversationService struct {
	mu            sync.RWMutex
	conversations map[string]*domain.Conversation
}

func NewConversationService() *ConversationService {
	return &ConversationService{conversations: make(map[string]*domain.Conversation)}
}

func (s *ConversationService) List(userID int64) []domain.Conversation {
	s.mu.RLock()
	defer s.mu.RUnlock()
	res := make([]domain.Conversation, 0)
	for _, c := range s.conversations {
		if c.UserID == userID {
			res = append(res, *c)
		}
	}
	sort.Slice(res, func(i, j int) bool { return res[i].UpdatedAt.After(res[j].UpdatedAt) })
	return res
}

func (s *ConversationService) Get(id string) (domain.Conversation, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.conversations[id]
	if !ok {
		return domain.Conversation{}, false
	}
	return *c, true
}

func (s *ConversationService) Create(userID int64, title string) domain.Conversation {
	if title == "" {
		title = "新会话"
	}
	now := time.Now()
	c := domain.Conversation{ID: uuid.NewString(), UserID: userID, Title: title, CreatedAt: now, UpdatedAt: now, Messages: []domain.ConversationMessage{}}
	s.mu.Lock()
	s.conversations[c.ID] = &c
	s.mu.Unlock()
	return c
}

func (s *ConversationService) Update(id, title string) (domain.Conversation, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.conversations[id]
	if !ok {
		return domain.Conversation{}, false
	}
	if title != "" {
		c.Title = title
	}
	c.UpdatedAt = time.Now()
	return *c, true
}

func (s *ConversationService) Delete(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.conversations[id]; !ok {
		return false
	}
	delete(s.conversations, id)
	return true
}

func (s *ConversationService) Clear(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.conversations[id]
	if !ok {
		return false
	}
	c.Messages = []domain.ConversationMessage{}
	c.UpdatedAt = time.Now()
	return true
}

func (s *ConversationService) AddMessage(conversationID string, m domain.ConversationMessage) (domain.ConversationMessage, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.conversations[conversationID]
	if !ok {
		return domain.ConversationMessage{}, false
	}
	m.ID = uuid.NewString()
	m.ConversationID = conversationID
	m.CreatedAt = time.Now()
	if m.DeviceName == "" {
		m.DeviceName = "Web"
	}
	c.Messages = append(c.Messages, m)
	c.UpdatedAt = time.Now()
	return m, true
}

func (s *ConversationService) Messages(conversationID string) ([]domain.ConversationMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.conversations[conversationID]
	if !ok {
		return nil, false
	}
	cp := make([]domain.ConversationMessage, len(c.Messages))
	copy(cp, c.Messages)
	return cp, true
}
