import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from '../components/TaijiLogo';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import FilePreview from '../components/FilePreview';
import { api, axiosInstance } from '../utils/api';
import { formatFileSize, getFileIcon } from '../utils/uploadHelper';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast as CapacitorToast } from '@capacitor/toast';
import { connectSocket } from '../utils/socket';

export default function Public() {
  const { user, token } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    loadPublicFiles();

    // 如果用户已登录，连接 Socket 监听文件变化
    if (user && token) {
      const socket = connectSocket(token);

      // 监听文件上传事件（只显示公开文件）
      const handleFileUploaded = (file) => {
        console.log('收到文件上传事件:', file);
        if (file.is_public === 1) {
          setFiles((prev) => {
            // 检查文件是否已存在，避免重复
            if (prev.some(f => f.id === file.id)) {
              return prev;
            }
            return [file, ...prev];
          });
        }
      };

      // 监听文件更新事件
      const handleFileUpdated = (data) => {
        console.log('收到文件更新事件:', data);
        setFiles((prev) => {
          if (data.is_public === 1) {
            // 文件变为公开，添加到列表
            const exists = prev.some(f => f.id === data.id);
            if (!exists) {
              // 需要重新加载文件详情
              loadPublicFiles();
            } else {
              // 更新现有文件
              return prev.map(f =>
                f.id === data.id ? { ...f, is_public: data.is_public } : f
              );
            }
          } else {
            // 文件变为私有，从列表中移除
            return prev.filter(f => f.id !== data.id);
          }
          return prev;
        });
      };

      // 监听文件删除事件
      const handleFileDeleted = (data) => {
        console.log('收到文件删除事件:', data);
        setFiles((prev) => prev.filter(f => f.id !== data.id));
        
        // 立即刷新公开文件列表，确保缓存被清除
        setTimeout(() => {
          console.log('[Public] 文件删除后刷新列表');
          loadPublicFiles();
        }, 100);
      };

      // 注册事件监听器
      socket.on('file_uploaded', handleFileUploaded);
      socket.on('file_updated', handleFileUpdated);
      socket.on('file_deleted', handleFileDeleted);

      // 清理函数
      return () => {
        socket.off('file_uploaded', handleFileUploaded);
        socket.off('file_updated', handleFileUpdated);
        socket.off('file_deleted', handleFileDeleted);
      };
    }
  }, [user, token]);

  const loadPublicFiles = async () => {
    setLoading(true);
    try {
      // 强制不使用缓存，确保显示最新的文件列表
      const data = await api.getPublicFiles(false);
      // 确保 data 是数组,防止 undefined 导致白屏
      setFiles(Array.isArray(data) ? data : []);
      console.log('[Public] 公开文件加载完成，数量:', data?.length || 0);
    } catch (error) {
      console.error('加载公开文件失败:', error);
      // 发生错误时设置为空数组
      setFiles([]);
    }
    setLoading(false);
  };

  const handleDownload = async (file) => {
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
      window.open(api.getDownloadUrl(file.id), '_blank');
    }
  };

  const handlePreview = (file) => {
    setPreviewFile(file);
  };

  return (
    <div className="min-h-screen bg-taiji-gray-100">
      {/* 根据登录状态显示不同的头部 */}
      {user ? (
        <Header />
      ) : (
        <header
          className="bg-taiji-white border-b-2 border-taiji-gray-200 sticky top-0 z-40"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div
            className="max-w-7xl mx-auto px-4 py-3"
            style={{
              paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
              paddingRight: 'calc(1rem + env(safe-area-inset-right))',
            }}
          >
            <div className="flex items-center justify-between">
              <Link to="/public" className="flex items-center gap-2">
                <TaijiLogo size={36} animate={false} />
                <div>
                  <h1 className="text-base md:text-lg font-bold text-taiji-black">太极</h1>
                  <p className="text-xs text-taiji-gray-500">文件传输</p>
                </div>
              </Link>
              <Link
                to="/login"
                className="px-4 py-2 bg-taiji-black text-taiji-white rounded-lg hover:bg-taiji-gray-800 transition-colors text-sm font-medium"
              >
                登录
              </Link>
            </div>
          </div>
        </header>
      )}

      <main
        className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8"
        style={{ paddingTop: user ? 'calc(60px + env(safe-area-inset-top))' : '0' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-taiji-black mb-2">公开文件</h1>
            <p className="text-sm md:text-base text-taiji-gray-500">这些文件对所有人公开可见</p>
          </div>

          {loading ? (
            <LoadingSpinner message="加载公开文件..." />
          ) : files.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-taiji-gray-400 text-lg">暂无公开文件</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {files.map((file) => {
                const isImage = file.mimetype?.startsWith('image/');

                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -5 }}
                    className="card p-4"
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
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handlePreview(file)}
                        className="flex-1 px-4 py-2 bg-taiji-white border border-taiji-gray-300 text-taiji-black rounded-lg text-sm font-medium hover:bg-taiji-gray-100 transition-colors"
                      >
                        预览
                      </button>
                      <button
                        onClick={() => handleDownload(file)}
                        className="flex-1 px-4 py-2 bg-taiji-black text-taiji-white rounded-lg text-sm font-medium hover:bg-taiji-gray-800 transition-colors"
                      >
                        下载
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>

      {/* 文件预览 */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

