import axios from 'axios';
import { Capacitor } from '@capacitor/core';

// 根据平台动态设置 baseURL
const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    // 在原生 App 中，直接指向后端服务IP
    return 'http://192.168.0.100:5000';
  }
  // 在 Web 环境中，使用相对路径，依赖 Vite 代理或部署环境的配置
  return '';
};

const API_BASE_URL = getBaseUrl();

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求缓存
const requestCache = new Map();
const CACHE_DURATION = 5000; // 5秒缓存

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // 添加 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加时间戳防止缓存
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 统一错误处理
    if (error.response?.status === 401) {
      // Token 过期，清除并跳转登录
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 缓存请求函数
const cachedRequest = async (key, requestFn, cacheDuration = CACHE_DURATION) => {
  const now = Date.now();
  const cached = requestCache.get(key);
  
  if (cached && now - cached.timestamp < cacheDuration) {
    return cached.data;
  }
  
  const data = await requestFn();
  requestCache.set(key, { data, timestamp: now });
  
  // 清理过期缓存
  setTimeout(() => {
    requestCache.delete(key);
  }, cacheDuration);
  
  return data;
};

export const api = {
  // 文件相关
  async getFiles(useCache = true) {
    const requestFn = async () => {
      const response = await axiosInstance.get('/api/files');
      return response.data.files;
    };
    
    if (useCache) {
      return cachedRequest('files', requestFn);
    }
    return requestFn();
  },

  async getPublicFiles(useCache = true) {
    const requestFn = async () => {
      const response = await axiosInstance.get('/api/files/public');
      return response.data.files;
    };
    
    if (useCache) {
      return cachedRequest('public-files', requestFn);
    }
    return requestFn();
  },

  async toggleVisibility(fileId) {
    const response = await axiosInstance.patch(`/api/files/${fileId}/visibility`);
    // 清除缓存
    requestCache.delete('files');
    requestCache.delete('public-files');
    return response.data;
  },

  async deleteFile(fileId) {
    const response = await axiosInstance.delete(`/api/files/${fileId}`);
    // 清除缓存
    requestCache.delete('files');
    requestCache.delete('public-files');
    return response.data;
  },

  getDownloadUrl(fileId) {
    const token = localStorage.getItem('token');
    const path = `/api/files/${fileId}/download`;
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    return API_BASE_URL + url;
  },

  getPreviewUrl(fileId) {
    const token = localStorage.getItem('token');
    const path = `/api/files/${fileId}/preview`;
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    return API_BASE_URL + url;
  },

  getThumbnailUrl(fileId) {
    const token = localStorage.getItem('token');
    const path = `/api/files/${fileId}/thumbnail`;
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    return API_BASE_URL + url;
  },
  
  // 清除所有缓存
  clearCache() {
    requestCache.clear();
  }
};

// 导出 axios 实例供其他地方使用
export { axiosInstance };

