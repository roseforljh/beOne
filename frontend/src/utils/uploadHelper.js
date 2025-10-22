import axios from 'axios';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export class FileUploader {
  constructor(file, onProgress) {
    this.file = file;
    this.onProgress = onProgress;
    this.uploadId = null;
    this.totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  }

  async upload() {
    try {
      // 1. 初始化上传
      const initResponse = await axios.post('/api/upload/init', {
        filename: this.file.name,
        totalChunks: this.totalChunks,
        fileSize: this.file.size,
        mimetype: this.file.type
      });

      this.uploadId = initResponse.data.uploadId;

      // 2. 上传分片
      const uploadPromises = [];
      for (let i = 0; i < this.totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, this.file.size);
        const chunk = this.file.slice(start, end);

        uploadPromises.push(this.uploadChunk(chunk, i));
      }

      await Promise.all(uploadPromises);

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
      console.error('上传失败:', error);
      return {
        success: false,
        error: error.response?.data?.error || '上传失败'
      };
    }
  }

  async uploadChunk(chunk, index) {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', this.uploadId);
    formData.append('chunkIndex', index);

    await axios.post('/api/upload/chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const chunkProgress = (progressEvent.loaded / progressEvent.total) * 100;
        const totalProgress = ((index + chunkProgress / 100) / this.totalChunks) * 100;
        
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

