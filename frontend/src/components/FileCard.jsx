import { motion } from 'framer-motion';
import { useState } from 'react';
import { formatFileSize, getFileIcon } from '../utils/uploadHelper';
import { api } from '../utils/api';

export default function FileCard({ file, onUpdate, onDelete, onPreview }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isImage = file.mimetype?.startsWith('image/');

  const handleToggleVisibility = async () => {
    try {
      const result = await api.toggleVisibility(file.id);
      if (onUpdate) {
        onUpdate({ ...file, is_public: result.is_public });
      }
    } catch (error) {
      alert('切换失败');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定要删除 "${file.original_name}" 吗？`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteFile(file.id);
      if (onDelete) {
        onDelete(file.id);
      }
    } catch (error) {
      alert('删除失败');
      setIsDeleting(false);
    }
  };

  const handleDownload = () => {
    window.open(api.getDownloadUrl(file.id), '_blank');
  };

  return (
    <motion.div
      className="card p-4 group"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5 }}
      layout
    >
      {/* 文件预览 */}
      <div className="relative w-full h-48 bg-taiji-gray-100 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
        {isImage ? (
          <img
            src={api.getThumbnailUrl(file.id)}
            alt={file.original_name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        
        <div className={`flex items-center justify-center w-full h-full ${isImage ? 'hidden' : ''}`}>
          <span className="text-6xl">{getFileIcon(file.mimetype)}</span>
        </div>

        {/* 公开标识 */}
        {file.is_public === 1 && (
          <div className="absolute top-2 right-2 bg-taiji-black text-taiji-white px-2 py-1 rounded text-xs font-medium">
            公开
          </div>
        )}
      </div>

      {/* 文件信息 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-taiji-black truncate" title={file.original_name}>
          {file.original_name}
        </h3>
        <p className="text-xs text-taiji-gray-500">
          {formatFileSize(file.size)}
        </p>
        <p className="text-xs text-taiji-gray-400">
          {new Date(file.created_at).toLocaleString('zh-CN')}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="mt-4 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={onPreview}
            className="flex-1 px-3 py-2 bg-taiji-white text-taiji-black border border-taiji-gray-300 rounded-lg text-xs font-medium hover:bg-taiji-gray-100 transition-colors"
          >
            预览
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 px-3 py-2 bg-taiji-black text-taiji-white rounded-lg text-xs font-medium hover:bg-taiji-gray-800 transition-colors"
          >
            下载
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleVisibility}
            className="flex-1 px-3 py-2 bg-taiji-white text-taiji-black border border-taiji-gray-300 rounded-lg text-xs font-medium hover:bg-taiji-gray-100 transition-colors"
          >
            {file.is_public ? '设为私有' : '设为公开'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? '...' : '删除'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

