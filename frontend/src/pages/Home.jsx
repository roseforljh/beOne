import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import FileUploader from '../components/FileUploader';
import FileCard from '../components/FileCard';
import LoadingSpinner from '../components/LoadingSpinner';
import FilePreview from '../components/FilePreview';
import { api } from '../utils/api';
import { connectSocket, getSocket } from '../utils/socket';

export default function Home() {
  const { user, token } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, public, private
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    loadFiles();

    // 确保 Socket 已连接
    const socket = connectSocket(token);

    // 定义事件处理函数
    const handleFileUploaded = (file) => {
      console.log('收到文件上传事件:', file);
      setFiles((prev) => {
        // 检查文件是否已存在，避免重复
        if (prev.some(f => f.id === file.id)) {
          return prev;
        }
        return [file, ...prev];
      });
    };

    const handleFileUpdated = (data) => {
      console.log('收到文件更新事件:', data);
      setFiles((prev) => prev.map(f => 
        f.id === data.id ? { ...f, is_public: data.is_public } : f
      ));
    };

    const handleFileDeleted = (data) => {
      console.log('收到文件删除事件:', data);
      setFiles((prev) => prev.filter(f => f.id !== data.id));
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
  }, [token]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await api.getFiles();
      setFiles(data);
    } catch (error) {
      console.error('加载文件失败:', error);
    }
    setLoading(false);
  };

  const handleUploadComplete = (file) => {
    setFiles([{ ...file, is_public: 0, created_at: new Date().toISOString() }, ...files]);
  };

  const handleFileUpdate = (updatedFile) => {
    setFiles(files.map(f => f.id === updatedFile.id ? updatedFile : f));
  };

  const handleFileDelete = (fileId) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  const filteredFiles = files.filter(file => {
    if (filter === 'public') return file.is_public === 1;
    if (filter === 'private') return file.is_public === 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-taiji-gray-100">
      <Header />

      <main className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
        {/* 上传区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-12"
        >
          <h2 className="text-xl md:text-2xl font-bold text-taiji-black mb-3 md:mb-4">
            {user?.is_guest ? '公共文件' : '上传文件'}
          </h2>
          <FileUploader onUploadComplete={handleUploadComplete} />
        </motion.div>

        {/* 文件列表 */}
        {!user?.is_guest && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-taiji-black">我的文件</h2>

            {/* 筛选器 */}
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === 'all'
                    ? 'bg-taiji-black text-taiji-white'
                    : 'bg-taiji-white text-taiji-black border border-taiji-gray-300 hover:bg-taiji-gray-100'
                }`}
              >
                全部 ({files.length})
              </button>
              <button
                onClick={() => setFilter('public')}
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === 'public'
                    ? 'bg-taiji-black text-taiji-white'
                    : 'bg-taiji-white text-taiji-black border border-taiji-gray-300 hover:bg-taiji-gray-100'
                }`}
              >
                公开 ({files.filter(f => f.is_public === 1).length})
              </button>
              <button
                onClick={() => setFilter('private')}
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === 'private'
                    ? 'bg-taiji-black text-taiji-white'
                    : 'bg-taiji-white text-taiji-black border border-taiji-gray-300 hover:bg-taiji-gray-100'
                }`}
              >
                私有 ({files.filter(f => f.is_public === 0).length})
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="加载文件列表..." />
          ) : filteredFiles.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-taiji-gray-400 text-lg">暂无文件</p>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20 md:pb-8"
            >
              <AnimatePresence>
                  {filteredFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onUpdate={handleFileUpdate}
                      onDelete={handleFileDelete}
                      onPreview={() => setPreviewFile(file)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}
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

