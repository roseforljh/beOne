import axios from 'axios';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export class FileUploader {
  constructor(file, onProgress, onSpeedUpdate) {
    this.file = file;
    this.onProgress = onProgress;
    this.onSpeedUpdate = onSpeedUpdate;
    this.uploadId = null;
    this.totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    this.uploadedBytes = 0;
    this.startTime = null;
    this.lastUpdateTime = null;
    this.lastUploadedBytes = 0;
    this.aborted = false;
    this.cancelTokenSource = null;
  }

  abort() {
    this.aborted = true;
    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel('上传已取消');
    }
  }

  async upload() {
    try {
      this.startTime = Date.now();
      this.lastUpdateTime = this.startTime;
      
      // 1. 初始化上传
      const initResponse = await axios.post('/api/upload/init', {
        filename: this.file.name,
        totalChunks: this.totalChunks,
        fileSize: this.file.size,
        mimetype: this.file.type
      });

      this.uploadId = initResponse.data.uploadId;

      // 2. 顺序上传分片（而不是并发），以获得更准确的进度
      for (let i = 0; i < this.totalChunks; i++) {
        if (this.aborted) {
          throw new Error('上传已取消');
        }
        
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, this.file.size);
        const chunk = this.file.slice(start, end);
        
        await this.uploadChunk(chunk, i);
      }

      if (this.aborted) {
        throw new Error('上传已取消');
      }

      // 3. 完成上传
      const completeResponse = await axios.post('/api/upload/complete', {
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

  async uploadChunk(chunk, index) {
    if (this.aborted) {
      throw new Error('上传已取消');
    }

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', this.uploadId);
    formData.append('chunkIndex', index);

    // 创建新的取消令牌
    this.cancelTokenSource = axios.CancelToken.source();

    await axios.post('/api/upload/chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      cancelToken: this.cancelTokenSource.token,
      onUploadProgress: (progressEvent) => {
        if (this.aborted) {
          this.cancelTokenSource.cancel('上传已取消');
          return;
        }

        // 计算当前分片的进度
        const chunkProgress = progressEvent.loaded / progressEvent.total;
        // 计算总体进度（0-100）
        const totalProgress = ((index + chunkProgress) / this.totalChunks) * 100;
        
        // 更新已上传字节数
        this.uploadedBytes = index * CHUNK_SIZE + progressEvent.loaded;
        
        // 计算传输速度（每500ms更新一次）
        const now = Date.now();
        if (now - this.lastUpdateTime >= 500) {
          const timeDiff = (now - this.lastUpdateTime) / 1000; // 秒
          const bytesDiff = this.uploadedBytes - this.lastUploadedBytes;
          const speed = bytesDiff / timeDiff; // 字节/秒
          
          this.lastUpdateTime = now;
          this.lastUploadedBytes = this.uploadedBytes;
          
          if (this.onSpeedUpdate) {
            this.onSpeedUpdate(speed);
          }
        }
        
        if (this.onProgress) {
          this.onProgress(totalProgress);
        }
      }
    });
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

