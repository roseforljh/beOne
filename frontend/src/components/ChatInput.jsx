import { useState, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { sendTextMessage, sendFileMessage, emitTyping, emitStopTyping } from '../utils/socket';
import { FileUploader as Uploader, formatFileSize } from '../utils/uploadHelper';
import FileTypeSelector from './FileTypeSelector';

const ChatInput = memo(function ChatInput({ conversationId, onFileSent }) {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadSpeed, setUploadSpeed] = useState({});
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [currentAccept, setCurrentAccept] = useState('*/*');
  const [currentCapture, setCurrentCapture] = useState(null);
  const uploadersRef = useRef([]);
  const [cancelledIndexes, setCancelledIndexes] = useState(new Set());

  const handleSend = useCallback(() => {
    if (message.trim()) {
      sendTextMessage(message.trim(), conversationId);
      setMessage('');
      emitStopTyping();
    }
  }, [message, conversationId]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleChange = useCallback((e) => {
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
  }, []);

  const handleCancelUpload = useCallback((index) => {
    setCancelledIndexes(prev => new Set([...prev, index]));
    if (uploadersRef.current[index]) {
      uploadersRef.current[index].cancel();
    }
  }, []);

  const handleCancelAll = useCallback(() => {
    uploadersRef.current.forEach((uploader, index) => {
      if (uploader) {
        uploader.cancel();
        setCancelledIndexes(prev => new Set([...prev, index]));
      }
    });
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setUploading(true);
      setUploadingFiles(files);
      setCancelledIndexes(new Set());
      uploadersRef.current = [];
      
      // 初始化进度和速度
      const initialProgress = {};
      const initialSpeed = {};
      files.forEach((file, index) => {
        initialProgress[index] = 0;
        initialSpeed[index] = 0;
      });
      setUploadProgress(initialProgress);
      setUploadSpeed(initialSpeed);

      // 顺序上传文件（一个接一个）
      const results = [];
      for (let index = 0; index < files.length; index++) {
        // 检查是否已取消
        if (cancelledIndexes.has(index)) {
          continue;
        }

        const file = files[index];
        const uploader = new Uploader(
          file,
          (prog) => {
            // console.log(`文件 ${index} 进度:`, prog);
            setUploadProgress(prev => ({
              ...prev,
              [index]: prog
            }));
          },
          (speed) => {
            setUploadSpeed(prev => ({
              ...prev,
              [index]: speed
            }));
          },
          'chat' // 会话中上传的文件，source='chat'
        );
        
        uploadersRef.current[index] = uploader;

        try {
          const result = await uploader.upload();
          
          // 检查是否在上传过程中被取消
          if (result.cancelled) {
            continue;
          }
          
          results.push({ index, file, result });

          // 上传成功立即发送消息
          if (result.success) {
            sendFileMessage(result.file.id, conversationId);
            if (onFileSent) {
              try {
                onFileSent(result.file);
              } catch (err) {
                console.error('onFileSent 回调执行失败:', err);
              }
            }
          }
        } catch (err) {
          console.error(`文件 ${index} 上传过程发生异常:`, err);
          results.push({
            index,
            file,
            result: { success: false, error: err.message }
          });
        }
      }

      // 检查失败的文件
      const failed = results.filter(r => !r.result.success && !r.result.cancelled);
      if (failed.length > 0) {
        console.error('上传失败的文件:', failed);
        // alert(`${failed.length} 个文件上传失败`); // 暂时移除 alert，避免打断用户
      }
    } catch (error) {
      console.error('文件选择处理过程中发生严重错误:', error);
    } finally {
      // 无论发生什么，都必须重置状态
      setUploading(false);
      setUploadingFiles([]);
      setUploadProgress({});
      setUploadSpeed({});
      setCancelledIndexes(new Set());
      uploadersRef.current = [];
      
      // 重置文件选择器
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [conversationId, onFileSent, cancelledIndexes]);

  return (
    <div className="border-t-2 border-taiji-gray-200 bg-taiji-white p-2 md:p-4 pb-6 md:pb-6">
      {uploading && uploadingFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 md:mb-3 bg-taiji-gray-100 rounded-lg p-2 md:p-3 space-y-3 max-h-48 overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs md:text-sm text-taiji-gray-600 font-medium">
              正在上传 {uploadingFiles.length} 个文件
            </div>
            <button
              onClick={handleCancelAll}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              全部取消
            </button>
          </div>
          {uploadingFiles.map((file, index) => {
            const progress = uploadProgress[index] ?? 0;
            const speed = uploadSpeed[index] ?? 0;
            const displayProgress = Math.min(Math.max(0, Math.round(progress)), 100);
            const isCancelled = cancelledIndexes.has(index);
            
            return (
              <div key={index} className="bg-taiji-white rounded-lg p-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-taiji-gray-700 truncate flex-1 mr-2 font-medium">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {!isCancelled && speed > 0 && (
                      <span className="text-xs text-taiji-gray-500">
                        {formatFileSize(speed)}/s
                      </span>
                    )}
                    {!isCancelled && displayProgress < 100 && (
                      <button
                        onClick={() => handleCancelUpload(index)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        ✕
                      </button>
                    )}
                    <span className="text-xs font-bold text-taiji-black min-w-[45px] text-right">
                      {isCancelled ? '已取消' : `${displayProgress}%`}
                    </span>
                  </div>
                </div>
                {!isCancelled && (
                  <>
                    <div className="w-full bg-taiji-gray-200 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="bg-taiji-black h-full rounded-full"
                        style={{ width: `${displayProgress}%` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-taiji-gray-500">
                        {formatFileSize(file.size)}
                      </span>
                      {displayProgress === 100 && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ 完成
                        </span>
                      )}
                    </div>
                  </>
                )}
                {isCancelled && (
                  <div className="text-xs text-red-500 mt-1">
                    上传已取消
                  </div>
                )}
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
          placeholder={uploading ? "上传中，仍可输入消息..." : "输入消息..."}
          className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-taiji-gray-300 rounded-lg focus:border-taiji-black focus:outline-none transition-colors"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!message.trim()}
          className="px-4 md:px-6 py-2 md:py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm md:text-base min-w-[60px]"
        >
          发送
        </motion.button>
      </div>
    </div>
  );
});

export default ChatInput;

