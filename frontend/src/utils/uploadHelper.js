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
    this.isFinished = false;
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
    if (this.isFinished) return { success: false, error: 'Upload already finished' };
    try {
      this.startTime = Date.now();
      this.lastUpdateTime = this.startTime;

      // 小文件直接上传，不分片
      if (this.file.size < SMALL_FILE_THRESHOLD) {
        return await this.uploadDirectly();
      }

      // 安卓端：启动定时器强制更新进度（降低频率到500ms）
      if (Capacitor.isNativePlatform()) {
        this.startProgressTimer();
      }

      // 1. 初始化上传
      const initResponse = await api.post('/api/upload/init', {
        filename: this.file.name,
        totalChunks: this.totalChunks,
        fileSize: this.file.size,
        mimetype: this.file.type,
        source: this.source
      });

      this.uploadId = initResponse.data.uploadId;

      // 2. 并发上传分片
      await this.uploadChunksConcurrently();

      if (this.aborted) {
        throw new Error('上传已取消');
      }

      // 3. 完成上传
      const completeResponse = await api.post('/api/upload/complete', {
        uploadId: this.uploadId,
        filename: this.file.name,
        totalChunks: this.totalChunks,
        mimetype: this.file.type,
        source: this.source
      });

      // 清理定时器
      if (this.progressUpdateTimer) {
        clearInterval(this.progressUpdateTimer);
        this.progressUpdateTimer = null;
      }

      // 标记为完成，防止后续的进度更新
      this.isFinished = true;

      // 上传完成，设置为 100%
      if (this.onProgress) {
        this.onProgress(100);
      }

      if (!completeResponse.data || !completeResponse.data.file) {
        return {
          success: false,
          error: '服务器响应格式错误'
        };
      }

      return {
        success: true,
        file: completeResponse.data.file
      };
    } catch (error) {
      this.isFinished = true;
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
      return {
        success: false,
        error: error.response?.data?.error || '上传失败'
      };
    }
  }

  // 小文件直接上传（不分片）
  async uploadDirectly() {
    try {
      const formData = new FormData();
      formData.append('file', this.file);
      formData.append('filename', this.file.name);
      formData.append('mimetype', this.file.type);
      formData.append('source', this.source);

      const response = await api.post('/api/upload/direct', formData, {
        timeout: Capacitor.isNativePlatform() ? 60000 : 30000,
        onUploadProgress: (progressEvent) => {
          if (this.aborted) return;
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          if (this.onProgress) {
            this.onProgress(Math.min(progress, 99));
          }
        }
      });

      this.isFinished = true;

      if (this.onProgress) {
        this.onProgress(100);
      }

      if (!response.data || !response.data.file) {
        return {
          success: false,
          error: '服务器响应格式错误'
        };
      }

      return {
        success: true,
        file: response.data.file
      };
    } catch (error) {
      this.isFinished = true;
      if (this.aborted) {
        return {
          success: false,
          cancelled: true,
          error: '上传已取消'
        };
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
      await api.post('/api/upload/chunk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: Capacitor.isNativePlatform() ? 30000 : 15000,
        cancelToken: cancelTokenSource.token,
        onUploadProgress: (progressEvent) => {
          if (this.aborted) {
            cancelTokenSource.cancel('上传已取消');
            return;
          }
          this.updateProgress(index, progressEvent.loaded, chunk.size);
        }
      });

      // 标记为已上传
      this.uploadedChunks.add(index);
      this.cancelTokenSources.delete(index);

      // 分片完成后也更新一次进度
      this.updateProgress(index, chunk.size, chunk.size);
    } catch (error) {
      this.cancelTokenSources.delete(index);
      throw error;
    }
  }

  // 安卓端：定时器强制更新进度（优化：降低频率到500ms）
  startProgressTimer() {
    this.progressUpdateTimer = setInterval(() => {
      if (this.aborted || this.isFinished) {
        clearInterval(this.progressUpdateTimer);
        return;
      }

      const completedChunks = this.uploadedChunks.size;
      const totalProgress = (completedChunks / this.totalChunks) * 100;
      const clampedProgress = Math.min(Math.max(0, totalProgress), 99);

      // 只有进度变化超过2%时才更新（减少UI更新频率）
      if (Math.abs(clampedProgress - this.lastReportedProgress) >= 2) {
        this.lastReportedProgress = clampedProgress;
        if (this.onProgress) {
          this.onProgress(clampedProgress);
        }
      }
    }, 500); // 每500ms检查一次（从200ms优化）
  }

  updateProgress(chunkIndex, chunkLoaded, chunkSize) {
    if (this.isFinished || this.aborted) return;

    // 计算总进度
    const completedChunks = this.uploadedChunks.size;
    const currentChunkProgress = chunkLoaded / chunkSize;
    const totalProgress = ((completedChunks + currentChunkProgress) / this.totalChunks) * 100;

    // 更新已上传字节数
    this.uploadedBytes = completedChunks * CHUNK_SIZE + chunkLoaded;

    // 计算传输速度（每300ms更新一次，减少计算频率）
    const now = Date.now();
    if (now - this.lastUpdateTime >= 300) {
      const timeDiff = (now - this.lastUpdateTime) / 1000;
      const bytesDiff = this.uploadedBytes - this.lastUploadedBytes;
      const speed = bytesDiff / timeDiff;

      this.lastUpdateTime = now;
      this.lastUploadedBytes = this.uploadedBytes;

      if (this.onSpeedUpdate) {
        this.onSpeedUpdate(speed);
      }
    }

    // 更新进度（优化：提高更新阈值减少UI刷新）
    if (this.onProgress) {
      const clampedProgress = Math.min(Math.max(0, totalProgress), 99);

      // 统一使用2%的更新阈值，减少UI更新频率
      if (Math.abs(clampedProgress - this.lastReportedProgress) >= 2) {
        this.lastReportedProgress = clampedProgress;
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

