import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUploader as Uploader } from '../utils/uploadHelper';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from './TaijiLogo';
import FileTypeSelector from './FileTypeSelector';

export default function FileUploader({ onUploadComplete }) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);
  const [currentAccept, setCurrentAccept] = useState('*/*');
  const [currentCapture, setCurrentCapture] = useState(null);
  const uploadersRef = useRef([]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 取消所有正在进行的上传
      if (uploadersRef.current.length > 0) {
        uploadersRef.current.forEach(uploader => {
          try {
            uploader.abort();
          } catch (e) {
            // 忽略取消错误
          }
        });
      }
      // 清理引用
      uploadersRef.current = [];
    };
  }, []);

  // 游客不能上传
  if (user?.is_guest) {
    return (
      <div className="w-full">
        <div className="relative border-4 border-dashed rounded-xl md:rounded-2xl p-4 md:p-8 bg-taiji-gray-50 border-taiji-gray-300">
          <div className="flex flex-col items-center justify-center space-y-3 md:space-y-4 text-center">
            <TaijiLogo size={60} animate={false} className="opacity-50 md:w-20 md:h-20" />
            <h3 className="text-base md:text-xl font-medium text-taiji-gray-500">
              游客模式不支持上传文件
            </h3>
            <p className="text-sm md:text-base text-taiji-gray-400">
              您可以下载和预览公共文件，使用对话板功能
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesSelect(files);
    }
  };

  const handleFilesSelect = (files) => {
    setSelectedFiles(files);
    // 初始化每个文件的进度
    const initialProgress = {};
    files.forEach((file, index) => {
      initialProgress[index] = 0;
    });
    setUploadProgress(initialProgress);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFilesSelect(files);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    uploadersRef.current = [];

    // 使用 setTimeout 确保状态更新后再开始上传
    await new Promise(resolve => setTimeout(resolve, 0));

    // 并发上传所有文件
    const uploadPromises = selectedFiles.map((file, index) => {
      const uploader = new Uploader(file, (prog) => {
        setUploadProgress(prev => ({
          ...prev,
          [index]: Math.round(prog)
        }));
      });

      // 保存上传器引用以便取消
      uploadersRef.current.push(uploader);

      return uploader.upload().then(result => ({
        index,
        file,
        result
      }));
    });

    try {
      const results = await Promise.all(uploadPromises);
      
      // 检查结果
      const cancelled = results.filter(r => r.result.cancelled);
      const failed = results.filter(r => !r.result.success && !r.result.cancelled);
      const succeeded = results.filter(r => r.result.success);

      if (succeeded.length > 0) {
        // 通知成功上传的文件
        succeeded.forEach(r => {
          if (onUploadComplete) {
            onUploadComplete(r.result.file);
          }
        });
      }

      if (cancelled.length > 0) {
        alert(`${cancelled.length} 个文件上传已取消`);
      }

      if (failed.length > 0) {
        alert(`${failed.length} 个文件上传失败`);
      }

      // 清空选择
      setSelectedFiles([]);
      setUploadProgress({});
      uploadersRef.current = [];
    } catch (error) {
      alert('上传过程中出现错误');
    }

    setUploading(false);
  };

  const handleCancelUpload = () => {
    // 中断所有上传
    uploadersRef.current.forEach(uploader => {
      uploader.abort();
    });
    
    // 清空状态
    setUploading(false);
    setSelectedFiles([]);
    setUploadProgress({});
    uploadersRef.current = [];
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setUploadProgress({});
  };

  return (
    <div className="w-full">
      <motion.div
        className={`relative border-4 border-dashed rounded-xl md:rounded-2xl p-4 md:p-8 transition-all duration-300 ${
          isDragging
            ? 'border-taiji-black bg-taiji-gray-100'
            : 'border-taiji-gray-300 bg-taiji-white'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={currentAccept}
          capture={currentCapture}
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="flex flex-col items-center justify-center space-y-3 md:space-y-4">
          <TaijiLogo size={60} animate={isDragging || uploading} className="md:w-20 md:h-20" />

          {selectedFiles.length === 0 && !uploading && (
            <>
              <h3 className="text-base md:text-xl font-medium text-taiji-black text-center">
                拖拽文件到此处
              </h3>
              <p className="text-sm md:text-base text-taiji-gray-500">或者</p>
              
              {/* 桌面端简单按钮 */}
              <div className="hidden md:block">
                <button
                  className="btn-primary text-sm md:text-base"
                  onClick={() => {
                    setCurrentAccept('*/*');
                    setCurrentCapture(null);
                    fileInputRef.current?.click();
                  }}
                >
                  选择文件
                </button>
              </div>

              {/* 移动端选择文件按钮 */}
              <div className="md:hidden">
                <button
                  className="btn-primary text-sm md:text-base"
                  onClick={() => {
                    setCurrentAccept('*/*');
                    setCurrentCapture(null);
                    fileInputRef.current?.click();
                  }}
                >
                  选择文件
                </button>
              </div>

              <p className="text-xs md:text-sm text-taiji-gray-400 text-center">
                支持多文件上传，所有文件类型，最大 1GB+
              </p>
            </>
          )}

          {selectedFiles.length > 0 && !uploading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-3 md:space-y-4"
            >
              <div className="text-center">
                <p className="text-base md:text-lg font-medium text-taiji-black">
                  已选择 {selectedFiles.length} 个文件
                </p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <p key={index} className="text-xs md:text-sm text-taiji-gray-600 truncate px-2">
                      {index + 1}. {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 md:gap-4 justify-center">
                <button className="btn-primary text-sm md:text-base" onClick={handleUpload}>
                  开始上传
                </button>
                <button className="btn-secondary text-sm md:text-base" onClick={handleCancel}>
                  取消
                </button>
              </div>
            </motion.div>
          )}

          {uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full space-y-2 md:space-y-3 max-h-80 overflow-y-auto"
            >
              <div className="text-center mb-3">
                <p className="text-base md:text-lg font-medium text-taiji-black">
                  上传中... ({Object.keys(uploadProgress).length}/{selectedFiles.length})
                </p>
                <button
                  onClick={handleCancelUpload}
                  className="mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                >
                  取消上传
                </button>
              </div>

              {selectedFiles.map((file, index) => {
                const progress = uploadProgress[index] || 0;
                return (
                  <div key={index} className="bg-taiji-white rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs md:text-sm text-taiji-black truncate flex-1 mr-2">
                        {file.name}
                      </p>
                      <span className="text-xs md:text-sm font-bold text-taiji-black">
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full bg-taiji-gray-200 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="bg-taiji-black h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

