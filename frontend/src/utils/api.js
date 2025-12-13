import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { API_CONFIG } from '../config/api.config';
import { apiCache } from './lruCache';
import { dbCache } from './indexedDBCache';
import { fileExistsFilter } from './bloomFilter';

// 根据平台动态设置 baseURL
const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    // 在原生 App 中，从 localStorage 读取用户配置的 API 地址
    const savedApiUrl = localStorage.getItem('apiUrl');
    return savedApiUrl || API_CONFIG.API_URL;
  }
  // 在 Web 环境中
  if (import.meta.env.DEV) {
    return ''; // 开发模式使用 Vite 代理
  } else {
    // 生产模式：使用与当前页面相同的协议和域名
    const protocol = window.location.protocol; // http: 或 https:
    const hostname = window.location.hostname; // 域名或IP
    const isHttps = protocol === 'https:';
    // HTTPS环境下不指定端口（使用默认443端口），HTTP环境使用5000端口
    const port = isHttps ? '' : ':5000';
    return `${protocol}//${hostname}${port}`;
  }
};

// 动态获取 API_BASE_URL，支持运行时更新
const getApiBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    const savedApiUrl = localStorage.getItem('apiUrl');
    return savedApiUrl || API_CONFIG.API_URL;
  }
  // Web 环境：与 getBaseUrl 保持一致
  if (import.meta.env.DEV) {
    return '';
  } else {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const isHttps = protocol === 'https:';
    const port = isHttps ? '' : ':5000';
    return `${protocol}//${hostname}${port}`;
  }
};

const API_BASE_URL = getBaseUrl();

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: Capacitor.isNativePlatform() ? 30000 : 15000, // 移动端30秒，Web端15秒
  headers: {
    'Content-Type': 'application/json'
  },
  maxRedirects: 3,
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024,
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

    // FormData 需要浏览器自动设置 Content-Type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else {
      config.headers['Content-Type'] = 'application/json';
    }

    // 移动端优化：添加压缩支持
    if (Capacitor.isNativePlatform()) {
      config.headers['Accept-Encoding'] = 'gzip, deflate';
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器（添加重试机制）
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // 网络错误重试机制（移动端优化）
    if (Capacitor.isNativePlatform() && !config._retry &&
      (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response)) {
      config._retry = true;
      config._retryCount = config._retryCount || 0;

      if (config._retryCount < 2) {
        config._retryCount += 1;
        await new Promise(resolve => setTimeout(resolve, 500 * config._retryCount));
        return axiosInstance(config);
      }
    }

    // Token 过期处理
    if (error.response?.status === 401) {
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
  // 文件相关（使用 LRU 缓存 + IndexedDB）
  async getFiles(useCache = true) {
    const cacheKey = 'files_list';

    if (useCache) {
      // 1. 先查 LRU 内存缓存（最快）
      const lruCached = apiCache.get(cacheKey);
      if (lruCached) {
        return lruCached;
      }

      // 2. 再查 IndexedDB（次快）
      try {
        const dbCached = await dbCache.getCachedResponse(cacheKey);
        if (dbCached) {
          apiCache.set(cacheKey, dbCached);
          return dbCached;
        }
      } catch (err) {
        // 静默处理
      }
    }

    // 3. 最后查询 API
    const response = await axiosInstance.get('/api/files');
    const files = response.data.files;

    if (useCache) {
      apiCache.set(cacheKey, files);
      dbCache.cacheResponse(cacheKey, files, 60000).catch(() => {});

      files.forEach(file => {
        fileExistsFilter.add(file.id);
      });
    }

    return files;
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
    requestCache.delete('files_list');
    apiCache.delete('files_list');
    apiCache.delete('public-files');

    try {
      await dbCache.deleteCachedResponse('files_list');
      await dbCache.deleteCachedResponse('public-files');
    } catch (err) {
      // 静默处理
    }

    return response.data;
  },

  async deleteFile(fileId) {
    const response = await axiosInstance.delete(`/api/files/${fileId}`);

    // 清除缓存
    requestCache.delete('files');
    requestCache.delete('public-files');
    requestCache.delete('files_list');
    apiCache.delete('files_list');
    apiCache.delete('public-files');

    try {
      await dbCache.deleteCachedResponse('files_list');
      await dbCache.deleteCachedResponse('public-files');
    } catch (err) {
      // 静默处理
    }

    fileExistsFilter.clear();

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
    apiCache.clear();
    try {
      dbCache.clear().catch(() => {});
    } catch (err) {
      // 静默处理
    }
  }
};

// 导出 axios 实例供其他地方使用
export { axiosInstance };

