import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from '../components/TaijiLogo';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import FilePreview from '../components/FilePreview';
import { api } from '../utils/api';
import { formatFileSize, getFileIcon } from '../utils/uploadHelper';

export default function Public() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    loadPublicFiles();
  }, []);

  const loadPublicFiles = async () => {
    setLoading(true);
    try {
      const data = await api.getPublicFiles();
      setFiles(data);
    } catch (error) {
      console.error('加载公开文件失败:', error);
    }
    setLoading(false);
  };

  const handleDownload = (fileId) => {
    window.open(api.getDownloadUrl(fileId), '_blank');
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
        <header className="bg-taiji-white border-b-2 border-taiji-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
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
                        onClick={() => handleDownload(file.id)}
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

