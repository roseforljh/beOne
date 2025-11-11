import axios from 'axios';
import { axiosInstance as api } from './api';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB - 更小的分片以提高并发效率
const MAX_CONCURRENT_UPLOADS = 3; // 最大并发上传数

export class FileUploader {
  constructor(file, onProgress, onSpeedUpdate) {
    this.file = file;
    this.onProgress = onProgress;
    this.onSpeedUpdate = onSpeedUpdate;
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
  }

  abort() {
    this.aborted = true;
    // 取消所有进行中的请求
    this.cancelTokenSources.forEach((source) => {
      source.cancel('上传已取消');
    });
    this.cancelTokenSources.clear();
  }

  cancel() {
    this.abort();
  }

  async upload() {
    try {
      this.startTime = Date.now();
      this.lastUpdateTime = this.startTime;
      
      // 1. 初始化上传（统一走 axiosInstance，原生端使用后端 IP 而非 http://localhost）
      const initResponse = await api.post('/api/upload/init', {
        filename: this.file.name,
        totalChunks: this.totalChunks,
        fileSize: this.file.size,
        mimetype: this.file.type
      });

      this.uploadId = initResponse.data.uploadId;

      // 2. 并发上传分片
      await this.uploadChunksConcurrently();

      if (this.aborted) {
        throw new Error('上传已取消');
      }

      // 3. 完成上传（统一走 axiosInstance）
      const completeResponse = await api.post('/api/upload/complete', {
        uploadId: this.uploadId,
        filename: this.file.name,
        totalChunks: this.totalChunks,
        mimetype: this.file.type
      });

      return {
        success: true,
        file: completeResponse.data.file
      };
    } catch (error) {
      if (this.aborted || error.message === '上传已取消') {
        return {
          success: false,
          cancelled: true,
          error: '上传已取消'
        };
      }
      console.error('上传失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '上传失败'
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
      // 分片上传（统一走 axiosInstance），CancelToken 继续沿用 axios 的静态属性
      await api.post('/api/upload/chunk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
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
    } catch (error) {
      this.cancelTokenSources.delete(index);
      throw error;
    }
  }

  updateProgress(chunkIndex, chunkLoaded, chunkSize) {
    // 计算总进度
    const completedChunks = this.uploadedChunks.size;
    const currentChunkProgress = chunkLoaded / chunkSize;
    const totalProgress = ((completedChunks + currentChunkProgress) / this.totalChunks) * 100;

    // 更新已上传字节数
    this.uploadedBytes = completedChunks * CHUNK_SIZE + chunkLoaded;

    // 计算传输速度（每300ms更新一次）
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

    if (this.onProgress) {
      this.onProgress(Math.min(totalProgress, 100));
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

