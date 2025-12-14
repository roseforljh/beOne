import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { formatFileSize, getFileIcon } from '../utils/uploadHelper';
import { api, axiosInstance } from '../utils/api';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast as CapacitorToast } from '@capacitor/toast';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';

async function saveBlobWithPicker(blob, filename) {
  const picker = window?.showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const ext = (filename || '').includes('.') ? filename.split('.').pop() : '';
      const handle = await picker({
        suggestedName: filename || 'download',
        types: ext
          ? [
              {
                description: 'File',
                accept: { 'application/octet-stream': [`.${ext}`] },
              },
            ]
          : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('showSaveFilePicker failed, fallback to default download:', e);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function FileCard({ file, onUpdate, onDelete, onPreview }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const cardRef = useRef(null);
  const isImage = file.mimetype?.startsWith('image/');

  // 懒加载：使用 Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' } // 提前 50px 开始加载
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const showToastMessage = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const handleToggleVisibility = async () => {
    try {
      const result = await api.toggleVisibility(file.id);
      if (onUpdate) {
        onUpdate({ ...file, is_public: result.is_public });
      }
      showToastMessage(result.is_public ? '已设为公开' : '已设为私有', 'success');
    } catch (error) {
      showToastMessage('切换失败', 'error');
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await api.deleteFile(file.id);
      if (onDelete) {
        onDelete(file.id);
      }
      showToastMessage('文件已删除', 'success');
    } catch (error) {
      showToastMessage('删除失败', 'error');
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        // 请求存储权限
        const permissions = await Filesystem.requestPermissions();
        if (permissions.publicStorage !== 'granted') {
          await CapacitorToast.show({
            text: '需要存储权限才能下载文件',
            duration: 'long',
          });
          return;
        }

        await CapacitorToast.show({
          text: `开始下载 ${file.original_name}...`,
          duration: 'short',
        });

        const response = await axiosInstance.get(`/api/files/${file.id}/download`, {
          responseType: 'blob',
        });
        const blob = response.data;

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result;
          try {
            await Filesystem.writeFile({
              path: file.original_name,
              data: base64data,
              directory: Directory.Documents,
            });

            await CapacitorToast.show({
              text: `${file.original_name} 已保存成功`,
              duration: 'long',
            });
          } catch (e) {
            console.error('文件保存失败', e);
            await CapacitorToast.show({
              text: `文件保存失败: ${e.message}`,
              duration: 'long',
            });
          }
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('下载失败:', error);
        await CapacitorToast.show({
          text: `下载失败: ${error.message}`,
          duration: 'long',
        });
      }
    } else {
      const response = await axiosInstance.get(`/api/files/${file.id}/download`, {
        responseType: 'blob',
      });
      await saveBlobWithPicker(response.data, file.original_name);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className="card p-4 group"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5 }}
      layout
    >
      {/* 文件预览 */}
      <div className="relative w-full h-48 bg-taiji-gray-100 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
        {isImage && isInView ? (
          <>
            {/* 加载占位符 */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-taiji-gray-300 border-t-taiji-black rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={api.getThumbnailUrl(file.id)}
              alt={file.original_name}
              className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          </>
        ) : null}
        
        <div className={`flex items-center justify-center w-full h-full ${isImage && isInView && !imageLoaded ? 'hidden' : isImage ? 'hidden' : ''}`}>
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

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="删除文件"
        message={`确定要删除 "${file.original_name}" 吗？此操作不可恢复！`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
      />

      {/* Toast 提示 */}
      <Toast
        isOpen={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
        type={toastType}
      />
    </motion.div>
  );
}

