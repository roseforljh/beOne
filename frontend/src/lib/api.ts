import axios from 'axios';

const getApiBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) return envUrl;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

export const resolveUrl = (path?: string | null) => {
  if (!path) return null;
  try {
    return new URL(path, API_BASE_URL).toString();
  } catch {
    return path;
  }
};

const getFilenameFromContentDisposition = (contentDisposition?: string) => {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const raw = match?.[1] || match?.[2];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const normalizeFile = <T extends { download_url?: string | null; public_url?: string | null }>(file: T) => {
  return {
    ...file,
    download_url: file.download_url ? (resolveUrl(file.download_url) || file.download_url) : file.download_url,
    public_url: file.public_url ? (resolveUrl(file.public_url) || file.public_url) : file.public_url,
  };
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  devLogin: async (username: string = 'dev_user', email: string = 'dev@example.com') => {
    const response = await api.post('/api/v1/auth/dev-login', { username, email });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  },
  oauthLoginUrl: (provider: 'github' | 'google') => {
    return new URL(`/api/v1/auth/oauth/${provider}/login`, getApiBaseUrl()).toString();
  },
};

export const usersApi = {
  updateMe: async (payload: { username?: string | null; email?: string | null }) => {
    const response = await api.patch('/api/v1/users/me', payload);
    return response.data;
  },
  changePassword: async (payload: { current_password?: string | null; new_password: string }) => {
    const response = await api.post('/api/v1/users/change-password', payload);
    return response.data;
  },
};

// Files API
export const filesApi = {
  upload: async (
    file: File,
    isPublic: boolean = false,
    deviceName: string = 'Web',
    clientId?: string,
    notifyWs: boolean = true,
    source: 'drive' | 'gallery' = 'drive'
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_public', String(isPublic));
    formData.append('notify_ws', String(notifyWs));
    formData.append('source', source);
    formData.append('device_name', deviceName);
    if (clientId) {
      formData.append('client_id', clientId);
    }
    
    const response = await api.post('/api/v1/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (response.data?.file) {
      return { ...response.data, file: normalizeFile(response.data.file) };
    }
    return response.data;
  },
  list: async (skip: number = 0, limit: number = 50, source?: 'drive' | 'gallery') => {
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (source) qs.set('source', source);
    const response = await api.get(`/api/v1/files/?${qs.toString()}`);
    if (Array.isArray(response.data)) {
      return response.data.map((f) => normalizeFile(f));
    }
    return response.data;
  },
  download: async (fileId: string) => {
    const response = await api.get(`/api/v1/files/${fileId}`, { responseType: 'blob' });
    const filename = getFilenameFromContentDisposition(response.headers?.['content-disposition']);
    return { blob: response.data as Blob, filename };
  },
  update: async (fileId: string, data: { is_public?: boolean; filename?: string }) => {
    const response = await api.patch(`/api/v1/files/${fileId}`, data);
    return normalizeFile(response.data);
  },
  delete: async (fileId: string) => {
    const response = await api.delete(`/api/v1/files/${fileId}`);
    return response.data;
  },
};

// Conversations API
export interface ConversationMessage {
  id: string;
  conversation_id: string;
  type: 'text' | 'file';
  content?: string;
  filename?: string;
  file_id?: string;
  mime_type?: string;
  device_name: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: ConversationMessage;
  messages?: ConversationMessage[];
}

export const conversationsApi = {
  list: async (): Promise<Conversation[]> => {
    const response = await api.get('/api/v1/conversations');
    return response.data;
  },
  get: async (id: string): Promise<Conversation> => {
    const response = await api.get(`/api/v1/conversations/${id}`);
    return response.data;
  },
  create: async (title: string = '新会话'): Promise<Conversation> => {
    const response = await api.post('/api/v1/conversations', { title });
    return response.data;
  },
  update: async (id: string, data: { title?: string }): Promise<Conversation> => {
    const response = await api.patch(`/api/v1/conversations/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/conversations/${id}`);
  },
  clear: async (id: string): Promise<void> => {
    await api.post(`/api/v1/conversations/${id}/clear`);
  },
  addMessage: async (conversationId: string, message: {
    type: 'text' | 'file';
    content?: string;
    filename?: string;
    file_id?: string;
    mime_type?: string;
    device_name?: string;
  }): Promise<ConversationMessage> => {
    const response = await api.post(`/api/v1/conversations/${conversationId}/messages`, message);
    return response.data;
  },
  getMessages: async (conversationId: string): Promise<ConversationMessage[]> => {
    const response = await api.get(`/api/v1/conversations/${conversationId}/messages`);
    return response.data;
  },
};
