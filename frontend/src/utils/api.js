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
  timeout: 10000, // 10秒超时（移动端优化）
  headers: {
    'Content-Type': 'application/json'
    // 移除 'Connection': 'keep-alive' 因为这是不安全的头部，浏览器会拒绝设置
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
    // 添加 token（始终从 localStorage 获取最新的 token）
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 重要：不要覆盖 FormData 的 Content-Type
    // FormData 需要浏览器自动设置 multipart/form-data 边界
    if (config.data instanceof FormData) {
      // 删除默认的 Content-Type，让浏览器自动设置
      delete config.headers['Content-Type'];
      console.log('[API Request] FormData请求，删除Content-Type头部');
    } else {
      // 非 FormData 请求保持 JSON 格式
      config.headers['Content-Type'] = 'application/json';
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
    
    // 调试日志：检查token是否正确传递
    console.log('[API Request]', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL || ''}${config.url || ''}`,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 30) + '...' : 'none',
      headers: {
        ...config.headers,
        Authorization: config.headers.Authorization ? config.headers.Authorization.substring(0, 40) + '...' : 'none'
      }
    });
    
    if (!token) {
      console.error('[API] ⚠️ 没有找到 token，请求可能会失败');
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
    
    // 403错误详细日志
    if (error.response?.status === 403) {
      console.error('[API] 403 Forbidden Error:', {
        url: config.url,
        method: config.method,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL || ''}${config.url || ''}`,
        headers: config.headers,
        hasToken: !!config.headers.Authorization,
        tokenPreview: config.headers.Authorization ? config.headers.Authorization.substring(0, 20) + '...' : 'none',
        responseData: error.response.data,
        requestTime: new Date().toISOString()
      });
    }
    
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
      console.warn('[API] Token expired, clearing and redirecting to login');
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
        console.log('[LRU Cache HIT] files');
        return lruCached;
      }

      // 2. 再查 IndexedDB（次快）
      try {
        const dbCached = await dbCache.getCachedResponse(cacheKey);
        if (dbCached) {
          console.log('[IndexedDB Cache HIT] files');
          apiCache.set(cacheKey, dbCached); // 同步到 LRU
          return dbCached;
        }
      } catch (err) {
        console.warn('[IndexedDB] 读取失败:', err);
      }
    }

    // 3. 最后查询 API
    const response = await axiosInstance.get('/api/files');
    const files = response.data.files;

    if (useCache) {
      // 缓存到 LRU 和 IndexedDB
      apiCache.set(cacheKey, files);
      dbCache.cacheResponse(cacheKey, files, 60000).catch(err => {
        console.warn('[IndexedDB] 写入失败:', err);
      });

      // 更新布隆过滤器
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
    
    // 清除所有缓存，确保可见性更新立即生效
    console.log('[API] 清除文件缓存，更新可见性，文件ID:', fileId);
    
    // 清除内存缓存
    requestCache.delete('files');
    requestCache.delete('public-files');
    requestCache.delete('files_list');
    
    // 清除 LRU 缓存
    apiCache.delete('files_list');
    apiCache.delete('public-files');
    
    // 清除 IndexedDB 缓存
    try {
      await dbCache.deleteCachedResponse('files_list');
      await dbCache.deleteCachedResponse('public-files');
      console.log('[API] IndexedDB 缓存已清除（可见性更新）');
    } catch (err) {
      console.warn('[IndexedDB] 删除缓存失败:', err);
    }
    
    return response.data;
  },

  async deleteFile(fileId) {
    const response = await axiosInstance.delete(`/api/files/${fileId}`);
    
    // 强制清除所有缓存，确保删除操作立即生效
    console.log('[API] 清除所有文件缓存，删除文件ID:', fileId);
    
    // 清除内存缓存
    requestCache.delete('files');
    requestCache.delete('public-files');
    requestCache.delete('files_list');
    
    // 清除 LRU 缓存
    apiCache.delete('files_list');
    apiCache.delete('public-files');
    
    // 清除 IndexedDB 缓存
    try {
      await dbCache.deleteCachedResponse('files_list');
      await dbCache.deleteCachedResponse('public-files');
      console.log('[API] IndexedDB 缓存已清除');
    } catch (err) {
      console.warn('[IndexedDB] 删除缓存失败:', err);
    }
    
    // 清空布隆过滤器（因为布隆过滤器不支持精确删除）
    fileExistsFilter.clear();
    
    // 强制刷新页面缓存，确保下次 loadFiles 不使用缓存
    const now = Date.now();
    console.log('[API] 文件删除完成，时间戳:', now);
    
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
    // 清除 IndexedDB 缓存
    try {
      dbCache.clear().catch(err => {
        console.warn('[IndexedDB] 清空缓存失败:', err);
      });
    } catch (err) {
      console.warn('[IndexedDB] 清空缓存失败:', err);
    }
  }
};

// 导出 axios 实例供其他地方使用
export { axiosInstance };

