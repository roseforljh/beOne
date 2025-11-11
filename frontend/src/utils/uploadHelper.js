import axios from 'axios';
import { axiosInstance as api } from './api';
import { Capacitor } from '@capacitor/core';

// 小文件阈值：小于此大小的文件直接上传，不分片
const SMALL_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB

// 移动端优化：根据平台调整分片大小
const CHUNK_SIZE = Capacitor.isNativePlatform()
  ? 1 * 1024 * 1024  // 移动端：1MB 分片，减少单次传输大小
  : 2 * 1024 * 1024; // Web端：2MB 分片

// 不限制并发数，让系统自动处理
const MAX_CONCURRENT_UPLOADS = Capacitor.isNativePlatform()
  ? 5  // 移动端：5个并发
  : 6; // Web端：6个并发

export class FileUploader {
  constructor(file, onProgress, onSpeedUpdate, source = 'user') {
    this.file = file;
    this.onProgress = onProgress;
    this.onSpeedUpdate = onSpeedUpdate;
    this.source = source; // 'user' = 我的文件页面, 'chat' = 会话中上传
    this.uploadId = null;
    this.totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    this.uploadedBytes = 0;
    this.uploadedChunks = new Set();
    this.startTime = null;
    this.lastUpdateTime = null;
    this.lastUploadedBytes = 0;
    this.aborted = false;
    this.cancelTokenSources = new Map();
    this.retryCount = new Map();
    this.maxRetries = 3;
    this.lastReportedProgress = 0;
    this.progressUpdateTimer = null;
  }

  abort() {
    this.aborted = true;
    // 取消所有进行中的请求
    this.cancelTokenSources.forEach((source) => {
      source.cancel('上传已取消');
    });
    this.cancelTokenSources.clear();
    
    // 清理定时器
    if (this.progressUpdateTimer) {
      clearInterval(this.progressUpdateTimer);
      this.progressUpdateTimer = null;
    }
  }

  cancel() {
    this.abort();
  }

  async upload() {
    try {
      console.log(`[上传开始] 文件: ${this.file.name}, 大小: ${(this.file.size / 1024 / 1024).toFixed(2)}MB, 分片数: ${this.totalChunks}`);
      const uploadStartTime = Date.now();
      
      this.startTime = Date.now();
      this.lastUpdateTime = this.startTime;
      
      // 小文件直接上传，不分片
      if (this.file.size < SMALL_FILE_THRESHOLD) {
        console.log('[快速模式] 小文件直接上传，不分片');
        return await this.uploadDirectly();
      }
      
      // 安卓端：启动定时器强制更新进度
      if (Capacitor.isNativePlatform()) {
        this.startProgressTimer();
      }
      
      // 1. 初始化上传（统一走 axiosInstance，原生端使用后端 IP 而非 http://localhost）
      console.log('[步骤1] 开始初始化上传...');
      console.log('[步骤1] API baseURL:', api.defaults.baseURL);
      
      // 移动端特殊处理：确保使用正确的API地址
      let apiUrl = api.defaults.baseURL;
      if (Capacitor.isNativePlatform()) {
        const savedApiUrl = localStorage.getItem('apiUrl');
        if (savedApiUrl && savedApiUrl !== apiUrl) {
          console.log('[移动端] 使用存储的API地址:', savedApiUrl);
          apiUrl = savedApiUrl;
        }
      }
      
      const initStartTime = Date.now();
      const initResponse = await api.post('/api/upload/init', {
        filename: this.file.name,
        totalChunks: this.totalChunks,
        fileSize: this.file.size,
        mimetype: this.file.type,
        source: this.source
      });
      console.log(`[步骤1] 初始化完成，耗时: ${Date.now() - initStartTime}ms, uploadId: ${initResponse.data.uploadId}`);

      this.uploadId = initResponse.data.uploadId;

      // 2. 并发上传分片
      console.log('[步骤2] 开始上传分片...');
      const chunksStartTime = Date.now();
      await this.uploadChunksConcurrently();
      console.log(`[步骤2] 分片上传完成，耗时: ${Date.now() - chunksStartTime}ms`);

      if (this.aborted) {
        throw new Error('上传已取消');
      }

      // 3. 完成上传（统一走 axiosInstance）
      console.log('[步骤3] 开始完成上传...');
      console.log('[步骤3] API baseURL:', api.defaults.baseURL);
      
      apiUrl = api.defaults.baseURL;
      
      // 移动端特殊处理：确保使用正确的API地址
      if (Capacitor.isNativePlatform()) {
        const savedApiUrl = localStorage.getItem('apiUrl');
        if (savedApiUrl && savedApiUrl !== apiUrl) {
          console.log('[移动端] 使用存储的API地址:', savedApiUrl);
          apiUrl = savedApiUrl;
        }
      }
      
      const completeStartTime = Date.now();
      const completeResponse = await api.post('/api/upload/init', {
        uploadId: this.uploadId,
        filename: this.file.name,
        totalChunks: this.totalChunks,
        mimetype: this.file.type,
        source: this.source
      });
      console.log(`[步骤3] 完成上传，耗时: ${Date.now() - completeStartTime}ms`);

      // 清理定时器
      if (this.progressUpdateTimer) {
        clearInterval(this.progressUpdateTimer);
        this.progressUpdateTimer = null;
      }

      // 上传完成，设置为 100%
      if (this.onProgress) {
        this.onProgress(100);
      }

      const totalTime = Date.now() - uploadStartTime;
      console.log(`[上传完成] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

      return {
        success: true,
        file: completeResponse.data.file
      };
    } catch (error) {
      // 清理定时器
      if (this.progressUpdateTimer) {
        clearInterval(this.progressUpdateTimer);
        this.progressUpdateTimer = null;
      }
      
      if (this.aborted || error.message === '上传已取消') {
        return {
          success: false,
          cancelled: true,
          error: '上传已取消'
        };
      }
      console.error('[上传失败]', error);
      return {
        success: false,
        error: error.response?.data?.error || '上传失败'
      };
    }
  }

  // 小文件直接上传（不分片）
  async uploadDirectly() {
    const uploadStartTime = Date.now();
    
    try {
      console.log('[直接上传] 准备FormData，文件:', this.file.name, '大小:', this.file.size);
      
      const formData = new FormData();
      formData.append('file', this.file);
      formData.append('filename', this.file.name);
      formData.append('mimetype', this.file.type);
      formData.append('source', this.source);

      console.log('[直接上传] FormData创建完成，开始上传...');
      console.log('[直接上传] FormData内容:', {
        hasFile: formData.has('file'),
        filename: this.file.name,
        mimetype: this.file.type,
        source: this.source,
        fileSize: this.file.size
      });
      
      const response = await api.post('/api/upload/direct', formData, {
        // 注意：不要手动设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
        timeout: Capacitor.isNativePlatform() ? 60000 : 30000,
        onUploadProgress: (progressEvent) => {
          if (this.aborted) {
            return;
          }
          
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          if (this.onProgress) {
            this.onProgress(Math.min(progress, 99));
          }
          
          console.log(`[直接上传] 上传进度: ${progress.toFixed(2)}% (${progressEvent.loaded}/${progressEvent.total} bytes)`);
        }
      });

      // 上传完成
      if (this.onProgress) {
        this.onProgress(100);
      }

      const totalTime = Date.now() - uploadStartTime;
      console.log(`[直接上传完成] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

      return {
        success: true,
        file: response.data.file
      };
    } catch (error) {
      if (this.aborted) {
        console.log('[直接上传] 用户取消上传');
        return {
          success: false,
          cancelled: true,
          error: '上传已取消'
        };
      }
      
      console.error('[直接上传失败]', {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers
        } : null
      });
      
      // 移动端特殊错误处理
      if (Capacitor.isNativePlatform()) {
        console.error('[移动端直接上传] 详细错误:', error);
        
        // 尝试获取更详细的错误信息
        if (error.response) {
          console.error('[移动端直接上传] 响应状态:', error.response.status);
          console.error('[移动端直接上传] 响应数据:', error.response.data);
        }
        
        // 检查网络连接状态
        console.log('[移动端直接上传] 网络状态:', navigator.onLine ? navigator.onLine() : '未知');
        
        // 检查存储权限
        console.log('[移动端直接上传] 存储权限:', navigator.storage && navigator.storage.persisted ? '可用' : '不可用');
      }
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || '上传失败'
      };
    }
  }

  async uploadChunksConcurrently() {
    const chunks = Array.from({ length: this.totalChunks }, (_, i) => i);
    const queue = [...chunks];
    const activeUploads = new Set();

    const uploadNext = async () => {
      if (queue.length === 0 || this.aborted) {
        return;
      }

      const index = queue.shift();
      const uploadPromise = this.uploadChunkWithRetry(index)
        .finally(() => {
          activeUploads.delete(uploadPromise);
          if (queue.length > 0 && !this.aborted) {
            return uploadNext();
          }
        });

      activeUploads.add(uploadPromise);
      return uploadPromise;
    };

    // 启动初始并发上传
    const initialUploads = Array.from(
      { length: Math.min(MAX_CONCURRENT_UPLOADS, this.totalChunks) },
      () => uploadNext()
    );

    await Promise.all(initialUploads);
    
    // 等待所有上传完成
    while (activeUploads.size > 0) {
      await Promise.race(activeUploads);
    }
  }

  async uploadChunkWithRetry(index, retryCount = 0) {
    try {
      await this.uploadChunk(index);
    } catch (error) {
      if (this.aborted || error.message === '上传已取消') {
        throw error;
      }

      if (retryCount < this.maxRetries) {
        console.log(`分片 ${index} 上传失败，重试 ${retryCount + 1}/${this.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.uploadChunkWithRetry(index, retryCount + 1);
      }

      throw error;
    }
  }

  async uploadChunk(index) {
    if (this.aborted) {
      throw new Error('上传已取消');
    }

    // 如果已上传，跳过
    if (this.uploadedChunks.has(index)) {
      return;
    }

    const chunkStartTime = Date.now();
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, this.file.size);
    const chunk = this.file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', this.uploadId);
    formData.append('chunkIndex', index);

    // 创建取消令牌
    const cancelTokenSource = axios.CancelToken.source();
    this.cancelTokenSources.set(index, cancelTokenSource);

    try {
      console.log(`[分片${index}] 开始上传 (${(chunk.size / 1024).toFixed(2)}KB)`);
      
      // 分片上传（统一走 axiosInstance），CancelToken 继续沿用 axios 的静态属性
      await api.post('/api/upload/chunk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        // 移动端优化：增加超时时间用于上传
        timeout: Capacitor.isNativePlatform() ? 30000 : 15000,
        cancelToken: cancelTokenSource.token,
        onUploadProgress: (progressEvent) => {
          if (this.aborted) {
            cancelTokenSource.cancel('上传已取消');
            return;
          }

          // 实时更新进度
          this.updateProgress(index, progressEvent.loaded, chunk.size);
        }
      });

      const chunkTime = Date.now() - chunkStartTime;
      console.log(`[分片${index}] 上传完成，耗时: ${chunkTime}ms`);
      
      // 标记为已上传
      this.uploadedChunks.add(index);
      this.cancelTokenSources.delete(index);
      
      // 分片完成后也更新一次进度，确保UI同步
      this.updateProgress(index, chunk.size, chunk.size);
    } catch (error) {
      console.error(`[分片${index}] 上传失败:`, error.message);
      this.cancelTokenSources.delete(index);
      throw error;
    }
  }

  // 安卓端：定时器强制更新进度
  startProgressTimer() {
    this.progressUpdateTimer = setInterval(() => {
      if (this.aborted) {
        clearInterval(this.progressUpdateTimer);
        return;
      }
      
      const completedChunks = this.uploadedChunks.size;
      const totalProgress = (completedChunks / this.totalChunks) * 100;
      const clampedProgress = Math.min(Math.max(0, totalProgress), 99);
      
      // 只有进度变化时才更新
      if (Math.abs(clampedProgress - this.lastReportedProgress) >= 1) {
        console.log(`[定时器] 强制更新进度: ${clampedProgress.toFixed(2)}%`);
        this.lastReportedProgress = clampedProgress;
        if (this.onProgress) {
          this.onProgress(clampedProgress);
        }
      }
    }, 200); // 每200ms检查一次
  }

  updateProgress(chunkIndex, chunkLoaded, chunkSize) {
    // 计算总进度
    const completedChunks = this.uploadedChunks.size;
    const currentChunkProgress = chunkLoaded / chunkSize;
    const totalProgress = ((completedChunks + currentChunkProgress) / this.totalChunks) * 100;

    // 更新已上传字节数
    this.uploadedBytes = completedChunks * CHUNK_SIZE + chunkLoaded;

    // 计算传输速度（每100ms更新一次，更频繁的反馈）
    const now = Date.now();
    if (now - this.lastUpdateTime >= 100) {
      const timeDiff = (now - this.lastUpdateTime) / 1000;
      const bytesDiff = this.uploadedBytes - this.lastUploadedBytes;
      const speed = bytesDiff / timeDiff;

      this.lastUpdateTime = now;
      this.lastUploadedBytes = this.uploadedBytes;

      if (this.onSpeedUpdate) {
        this.onSpeedUpdate(speed);
      }
    }

    // 立即更新进度
    if (this.onProgress) {
      const clampedProgress = Math.min(Math.max(0, totalProgress), 99);
      
      // 安卓端：降低更新阈值，从1%改为0.5%，让进度更平滑
      if (Capacitor.isNativePlatform()) {
        if (Math.abs(clampedProgress - this.lastReportedProgress) >= 0.5) {
          console.log(`[回调] 分片 ${chunkIndex} 进度: ${clampedProgress.toFixed(2)}% (已上传: ${(chunkLoaded / 1024).toFixed(2)}KB/${(chunkSize / 1024).toFixed(2)}KB)`);
          this.lastReportedProgress = clampedProgress;
          this.onProgress(clampedProgress);
        }
      } else {
        // Web端：正常更新
        console.log(`文件 ${chunkIndex} 进度:`, clampedProgress.toFixed(2));
        this.onProgress(clampedProgress);
      }
    }
  }
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const getFileIcon = (mimetype) => {
  if (!mimetype) return '📄';
  
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype.startsWith('video/')) return '🎬';
  if (mimetype.startsWith('audio/')) return '🎵';
  if (mimetype.includes('pdf')) return '📕';
  if (mimetype.includes('word') || mimetype.includes('document')) return '📘';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📗';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return '📙';
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z')) return '📦';
  if (mimetype.includes('text')) return '📝';
  
  return '📄';
};

