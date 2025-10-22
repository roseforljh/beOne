import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { sendTextMessage, sendFileMessage, emitTyping, emitStopTyping } from '../utils/socket';
import { FileUploader as Uploader } from '../utils/uploadHelper';
import FileTypeSelector from './FileTypeSelector';

export default function ChatInput({ onFileSent }) {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [currentAccept, setCurrentAccept] = useState('*/*');
  const [currentCapture, setCurrentCapture] = useState(null);

  const handleSend = () => {
    if (message.trim()) {
      sendTextMessage(message.trim());
      setMessage('');
      emitStopTyping();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);
    
    // 发送正在输入事件
    emitTyping();
    
    // 清除之前的超时
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // 3秒后停止输入状态
    typingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 3000);
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadingFiles(files);
    
    // 初始化进度
    const initialProgress = {};
    files.forEach((file, index) => {
      initialProgress[index] = 0;
    });
    setUploadProgress(initialProgress);

    // 并发上传所有文件
    const uploadPromises = files.map((file, index) => {
      const uploader = new Uploader(file, (prog) => {
        setUploadProgress(prev => ({
          ...prev,
          [index]: Math.round(prog)
        }));
      });

      return uploader.upload().then(result => ({
        index,
        file,
        result
      }));
    });

    try {
      const results = await Promise.all(uploadPromises);
      
      // 发送成功上传的文件消息
      const succeeded = results.filter(r => r.result.success);
      succeeded.forEach(r => {
        sendFileMessage(r.result.file.id);
        if (onFileSent) {
          onFileSent(r.result.file);
        }
      });

      const failed = results.filter(r => !r.result.success);
      if (failed.length > 0) {
        alert(`${failed.length} 个文件上传失败`);
      }
    } catch (error) {
      alert('上传过程中出现错误');
    }

    setUploading(false);
    setUploadingFiles([]);
    setUploadProgress({});
    
    // 重置文件选择器
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t-2 border-taiji-gray-200 bg-taiji-white p-2 md:p-4">
      {uploading && uploadingFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 md:mb-3 bg-taiji-gray-100 rounded-lg p-2 md:p-3 space-y-2 max-h-40 overflow-y-auto"
        >
          <div className="text-xs md:text-sm text-taiji-gray-600 font-medium mb-2">
            上传中... ({uploadingFiles.length} 个文件)
          </div>
          {uploadingFiles.map((file, index) => {
            const progress = uploadProgress[index] || 0;
            return (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-taiji-gray-700 truncate flex-1 mr-2">
                    {file.name}
                  </span>
                  <span className="text-xs font-medium text-taiji-black">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-taiji-gray-200 rounded-full h-1.5 overflow-hidden">
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

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={currentAccept}
          capture={currentCapture}
          className="hidden"
          onChange={handleFileSelect}
        />

        <FileTypeSelector
          position="top"
          disabled={uploading}
          onSelect={(type) => {
            setCurrentAccept(type.accept);
            setCurrentCapture(type.capture || null);
            // 延迟触发以确保属性更新
            setTimeout(() => {
              fileInputRef.current?.click();
            }, 100);
          }}
        />

        <input
          type="text"
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          disabled={uploading}
          className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-taiji-gray-300 rounded-lg focus:border-taiji-black focus:outline-none transition-colors disabled:opacity-50"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!message.trim() || uploading}
          className="px-4 md:px-6 py-2 md:py-3 bg-taiji-black text-taiji-white rounded-lg hover:bg-taiji-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm md:text-base min-w-[60px]"
        >
          发送
        </motion.button>
      </div>
    </div>
  );
}

