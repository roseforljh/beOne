import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { conversationsApi, Conversation as ApiConversation, ConversationMessage } from './api';

interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  auth_provider: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user });
      },
      setUser: (user) => {
        set({ user });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null });
      },
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'auth-storage',
    }
  )
);

export interface WSMessage {
  id: string;
  type: 'text' | 'file' | 'clipboard';
  content: string;
  device_name?: string;
  timestamp: Date;
  file_id?: string;
  filename?: string;
  mime_type?: string;
  isOwn?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: WSMessage[];
  createdAt: number;
  updatedAt: number;
}

// Helper to convert API message to WSMessage
const apiMessageToWSMessage = (msg: ConversationMessage, isOwn: boolean = false): WSMessage => ({
  id: msg.id,
  type: msg.type as 'text' | 'file',
  content: msg.content || msg.filename || '',
  device_name: msg.device_name,
  timestamp: new Date(msg.created_at),
  file_id: msg.file_id,
  filename: msg.filename,
  mime_type: msg.mime_type,
  isOwn,
});

// Helper to convert API conversation to local format
const apiConvToLocal = (conv: ApiConversation): Conversation => ({
  id: conv.id,
  title: conv.title,
  messages: (conv.messages || []).map((m) => apiMessageToWSMessage(m)),
  createdAt: new Date(conv.created_at).getTime(),
  updatedAt: new Date(conv.updated_at).getTime(),
});

interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  loading: boolean;
  
  // Async actions that call backend
  fetchConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addMessageToCurrentConversation: (message: WSMessage) => void;
  addMessageToBackend: (message: Omit<WSMessage, 'id' | 'timestamp'>) => Promise<void>;
  clearCurrentConversation: () => Promise<void>;
  getCurrentConversation: () => Conversation | undefined;
  getCurrentMessages: () => WSMessage[];
  
  // For handling WebSocket events
  handleConversationEvent: (event: { action: string; conversation_id: string; message?: ConversationMessage }) => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  loading: false,

  fetchConversations: async () => {
    set({ loading: true });
    try {
      const list = await conversationsApi.list();
      const conversations = list.map(apiConvToLocal);
      set({ 
        conversations,
        currentConversationId: get().currentConversationId || conversations[0]?.id || null,
      });
      
      // Fetch messages for current conversation
      const currentId = get().currentConversationId;
      if (currentId) {
        const detail = await conversationsApi.get(currentId);
        set((state) => ({
          conversations: state.conversations.map((c) => 
            c.id === currentId ? apiConvToLocal(detail) : c
          ),
        }));
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    } finally {
      set({ loading: false });
    }
  },

  createConversation: async () => {
    try {
      const newConv = await conversationsApi.create('新会话');
      const localConv = apiConvToLocal(newConv);
      set((state) => ({
        conversations: [localConv, ...state.conversations],
        currentConversationId: localConv.id,
      }));
      return localConv.id;
    } catch (e) {
      console.error('Failed to create conversation:', e);
      return '';
    }
  },

  selectConversation: async (id) => {
    set({ currentConversationId: id });
    try {
      const detail = await conversationsApi.get(id);
      set((state) => ({
        conversations: state.conversations.map((c) => 
          c.id === id ? apiConvToLocal(detail) : c
        ),
      }));
    } catch (e) {
      console.error('Failed to fetch conversation:', e);
    }
  },

  deleteConversation: async (id) => {
    // Prevent deleting the last conversation
    if (get().conversations.length <= 1) {
      console.warn('Cannot delete the last conversation');
      return;
    }
    try {
      await conversationsApi.delete(id);
      set((state) => {
        const filtered = state.conversations.filter((c) => c.id !== id);
        let newCurrentId = state.currentConversationId;
        if (state.currentConversationId === id) {
          newCurrentId = filtered[0]?.id || null;
        }
        return { conversations: filtered, currentConversationId: newCurrentId };
      });
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  },

  // Local-only add (for optimistic UI, before backend confirms)
  addMessageToCurrentConversation: (message) => {
    set((state) => {
      const currentId = state.currentConversationId;
      if (!currentId) return state;
      
      return {
        conversations: state.conversations.map((conv) => {
          if (conv.id === currentId) {
            return {
              ...conv,
              messages: [...conv.messages, message],
              updatedAt: Date.now(),
            };
          }
          return conv;
        }).sort((a, b) => b.updatedAt - a.updatedAt),
      };
    });
  },

  // Add message to backend
  addMessageToBackend: async (message) => {
    const currentId = get().currentConversationId;
    if (!currentId) return;
    
    try {
      await conversationsApi.addMessage(currentId, {
        type: message.type as 'text' | 'file',
        content: message.content,
        filename: message.filename,
        file_id: message.file_id,
        mime_type: message.mime_type,
        device_name: message.device_name,
      });
    } catch (e) {
      console.error('Failed to add message to backend:', e);
    }
  },

  clearCurrentConversation: async () => {
    const currentId = get().currentConversationId;
    if (!currentId) return;
    
    try {
      await conversationsApi.clear(currentId);
      set((state) => ({
        conversations: state.conversations.map((conv) => {
          if (conv.id === currentId) {
            return { ...conv, messages: [], updatedAt: Date.now() };
          }
          return conv;
        }),
      }));
    } catch (e) {
      console.error('Failed to clear conversation:', e);
    }
  },

  getCurrentConversation: () => {
    const state = get();
    return state.conversations.find((c) => c.id === state.currentConversationId);
  },

  getCurrentMessages: () => {
    const conv = get().getCurrentConversation();
    return conv?.messages || [];
  },

  // Handle WebSocket conversation events
  handleConversationEvent: (event) => {
    const { action, conversation_id, message } = event;
    
    switch (action) {
      case 'created':
        // Refetch conversations to get the new one
        get().fetchConversations();
        break;
      case 'deleted':
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== conversation_id),
          currentConversationId: state.currentConversationId === conversation_id 
            ? state.conversations.filter((c) => c.id !== conversation_id)[0]?.id || null
            : state.currentConversationId,
        }));
        break;
      case 'cleared':
        set((state) => ({
          conversations: state.conversations.map((c) => 
            c.id === conversation_id ? { ...c, messages: [], updatedAt: Date.now() } : c
          ),
        }));
        break;
      case 'message_added':
        if (message) {
          // Skip if message is from Web (same device) - already added locally
          if (message.device_name === 'Web') break;
          
          const wsMsg = apiMessageToWSMessage(message);
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id === conversation_id) {
                // Avoid duplicate by content+type
                const isDuplicate = c.messages.some((m) => 
                  m.id === wsMsg.id || 
                  (m.content === wsMsg.content && m.type === wsMsg.type)
                );
                if (isDuplicate) return c;
                return { ...c, messages: [...c.messages, wsMsg], updatedAt: Date.now() };
              }
              return c;
            }).sort((a, b) => b.updatedAt - a.updatedAt),
          }));
        }
        break;
    }
  },
}));

// Legacy chat store for backward compatibility
interface ChatState {
  messages: WSMessage[];
  addMessage: (message: WSMessage) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
}));
