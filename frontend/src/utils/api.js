import axios from 'axios';

export const api = {
  // 文件相关
  async getFiles() {
    const response = await axios.get('/api/files');
    return response.data.files;
  },

  async getPublicFiles() {
    const response = await axios.get('/api/files/public');
    return response.data.files;
  },

  async toggleVisibility(fileId) {
    const response = await axios.patch(`/api/files/${fileId}/visibility`);
    return response.data;
  },

  async deleteFile(fileId) {
    const response = await axios.delete(`/api/files/${fileId}`);
    return response.data;
  },

  getDownloadUrl(fileId) {
    const token = localStorage.getItem('token');
    const url = token 
      ? `/api/files/${fileId}/download?token=${encodeURIComponent(token)}`
      : `/api/files/${fileId}/download`;
    console.log('下载 URL:', url);
    return url;
  },

  getPreviewUrl(fileId) {
    const token = localStorage.getItem('token');
    const url = token 
      ? `/api/files/${fileId}/preview?token=${encodeURIComponent(token)}`
      : `/api/files/${fileId}/preview`;
    console.log('预览 URL:', url);
    return url;
  },

  getThumbnailUrl(fileId) {
    const token = localStorage.getItem('token');
    const url = token 
      ? `/api/files/${fileId}/thumbnail?token=${encodeURIComponent(token)}`
      : `/api/files/${fileId}/thumbnail`;
    console.log('缩略图 URL:', url);
    return url;
  }
};

