import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { API_CONFIG } from '../config/api.config';

// 根据平台动态设置 baseURL
const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    // 在原生 App 中，从 localStorage 读取用户配置的 API 地址
    const savedApiUrl = localStorage.getItem('apiUrl');
    return savedApiUrl || API_CONFIG.API_URL;
  }
  // 在 Web 环境中，使用相对路径，依赖 Vite 代理或部署环境的配置
  return '';
};

// 动态获取 API_BASE_URL，支持运行时更新
const getApiBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    const savedApiUrl = localStorage.getItem('apiUrl');
    return savedApiUrl || API_CONFIG.API_URL;
  }
  return '';
};

const API_BASE_URL = getBaseUrl();

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10秒超时（移动端优化）
  headers: {
    'Content-Type': 'application/json',
    'Connection': 'keep-alive'
  },
  // 移动端网络优化配置
  maxRedirects: 3,
  maxContentLength: 50 * 1024 * 1024, // 50MB
  maxBodyLength: 50 * 1024 * 1024,
  // 移动端优化：快速失败
  validateStatus: (status) => status >= 200 && status < 500
});

// 动态更新 baseURL 的函数
export const updateApiBaseUrl = () => {
  const newBaseUrl = getApiBaseUrl();
  axiosInstance.defaults.baseURL = newBaseUrl;
  return newBaseUrl;
};

// 请求缓存（移动端优化：更长的缓存时间）
const requestCache = new Map();
const CACHE_DURATION = Capacitor.isNativePlatform() ? 30000 : 5000; // 移动端 30 秒，Web 端 5 秒

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // 添加 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 移动端优化：添加压缩支持
    if (Capacitor.isNativePlatform()) {
      config.headers['Accept-Encoding'] = 'gzip, deflate';
    }
    
    // 添加时间戳防止缓存（仅 GET 请求）
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

// 响应拦截器（添加重试机制）
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // 网络错误重试机制（移动端优化）
    if (Capacitor.isNativePlatform() && !config._retry &&
        (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response)) {
      config._retry = true;
      config._retryCount = config._retryCount || 0;
      
      if (config._retryCount < 2) { // 最多重试2次
        config._retryCount += 1;
        console.log(`请求重试 ${config._retryCount}/2:`, config.url);
        
        // 指数退避：第一次等待500ms，第二次等待1000ms
        await new Promise(resolve => setTimeout(resolve, 500 * config._retryCount));
        return axiosInstance(config);
      }
    }
    
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
    const baseUrl = getApiBaseUrl();
    return baseUrl + url;
  },

  getPreviewUrl(fileId) {
    const token = localStorage.getItem('token');
    const path = `/api/files/${fileId}/preview`;
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    const baseUrl = getApiBaseUrl();
    return baseUrl + url;
  },

  getThumbnailUrl(fileId) {
    const token = localStorage.getItem('token');
    const path = `/api/files/${fileId}/thumbnail`;
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    const baseUrl = getApiBaseUrl();
    return baseUrl + url;
  },
  
  // 清除所有缓存
  clearCache() {
    requestCache.clear();
  }
};

// 导出 axios 实例供其他地方使用
export { axiosInstance };

