import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatFileSize, getFileIcon } from '../utils/uploadHelper';
import { api, axiosInstance } from '../utils/api';
import { recallMessage } from '../utils/socket';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';

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

const ChatMessage = memo(function ChatMessage({ message, isOwn, currentSessionId, onRecall }) {
  // 判断是否是当前会话发送的消息
  // 如果消息没有 session_id（旧消息），默认显示在右边
  const isCurrentSession = !message.session_id || message.session_id === currentSessionId;
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRecallConfirm, setShowRecallConfirm] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!message.file) return;

    if (Capacitor.isNativePlatform()) {
      try {
        // 请求存储权限
        const permissions = await Filesystem.requestPermissions();
        if (permissions.publicStorage !== 'granted') {
          await Toast.show({
            text: '需要存储权限才能下载文件',
            duration: 'long',
          });
          return;
        }

        await Toast.show({
          text: `开始下载 ${message.file.original_name}...`,
          duration: 'short',
        });

        const response = await axiosInstance.get(`/api/files/${message.file.id}/download`, {
          responseType: 'blob',
        });
        const blob = response.data;

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result;
          try {
            await Filesystem.writeFile({
              path: message.file.original_name,
              data: base64data,
              directory: Directory.Documents,
            });

            await Toast.show({
              text: `${message.file.original_name} 已保存成功`,
              duration: 'long',
            });
          } catch (e) {
            console.error('文件保存失败', e);
            await Toast.show({
              text: `文件保存失败: ${e.message}`,
              duration: 'long',
            });
          }
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('下载失败:', error);
        await Toast.show({
          text: `下载失败: ${error.message}`,
          duration: 'long',
        });
      }
    } else {
      const response = await axiosInstance.get(`/api/files/${message.file.id}/download`, {
        responseType: 'blob',
      });
      await saveBlobWithPicker(response.data, message.file.original_name);
    }
  }, [message.file]);

  const handleCopy = useCallback(async () => {
    try {
      let textToCopy = '';
      
      if (message.type === 'text') {
        textToCopy = message.content;
      } else if (message.type === 'file' && message.file) {
        textToCopy = `文件: ${message.file.original_name}\n大小: ${formatFileSize(message.file.size)}\n链接: ${window.location.origin}${api.getDownloadUrl(message.file.id)}`;
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败');
    }
  }, [message.type, message.content, message.file]);

  const handleRecall = useCallback(() => {
    setShowRecallConfirm(true);
  }, []);

  const confirmRecall = useCallback(() => {
    recallMessage(message.id);
    if (onRecall) {
      onRecall(message.id);
    }
    setShowRecallConfirm(false);
  }, [message.id, onRecall]);

  const cancelRecall = useCallback(() => {
    setShowRecallConfirm(false);
  }, []);

  const toggleActions = useCallback(() => {
    // 移动端点击切换
    if (window.innerWidth < 768) {
      setShowActions(!showActions);
    }
  }, [showActions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isCurrentSession ? 'justify-end' : 'justify-start'} mb-3 md:mb-4 group`}
      onClick={toggleActions}
    >
      <div className={`max-w-[90%] md:max-w-[85%] lg:max-w-[75%] ${isCurrentSession ? 'items-end' : 'items-start'} flex flex-col relative`}>
        {/* 用户名和时间 */}
        <div className="flex items-center gap-2 mb-1 px-2">
          <span className="text-xs text-taiji-gray-500 font-medium">
            {message.username}
          </span>
          <span className="text-xs text-taiji-gray-400">
            {new Date(message.created_at).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {/* 消息内容 */}
        <div className="relative w-full">
          <div
            className={`px-4 md:px-5 py-3 md:py-3.5 text-sm md:text-base shadow-sm ${
              isCurrentSession
                ? 'bg-gradient-to-br from-taiji-black to-gray-800 text-taiji-white rounded-[20px] rounded-br-md'
                : 'bg-taiji-gray-100 text-taiji-black rounded-[20px] rounded-bl-md border border-taiji-gray-200'
            }`}
          >
          {message.type === 'text' ? (
            <p className="whitespace-pre-wrap break-all">{message.content}</p>
          ) : message.type === 'file' && message.file ? (
            (() => {
              const isImage = message.file.mimetype?.startsWith('image/');
              const isVideo = message.file.mimetype?.startsWith('video/');
              
              // 图片类型：始终显示缩略图，无论大小
              if (isImage) {
                return (
                  <div className="flex flex-col gap-2 w-full max-w-[280px] md:max-w-[360px]">
                    <div className="relative w-full">
                      <img
                        src={api.getThumbnailUrl(message.file.id)}
                        alt={message.file.original_name}
                        className="w-full h-auto rounded-lg object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // 如果缩略图加载失败，尝试加载预览图
                          e.target.onerror = null;
                          e.target.src = api.getPreviewUrl(message.file.id);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs opacity-75 truncate">
                          {message.file.original_name}
                        </p>
                        <p className="text-xs opacity-60">
                          {message.file.size ? formatFileSize(message.file.size) : ''}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload();
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          isCurrentSession
                            ? 'bg-taiji-white text-taiji-black hover:bg-taiji-gray-100'
                            : 'bg-taiji-black text-taiji-white hover:bg-taiji-gray-800'
                        }`}
                      >
                        下载
                      </button>
                    </div>
                  </div>
                );
              }
              
              // 视频类型：始终显示视频预览，无论大小
              if (isVideo) {
                return (
                  <div className="flex flex-col gap-2 w-full max-w-[280px] md:max-w-[360px]">
                    <div className="relative w-full">
                      <video
                        src={api.getPreviewUrl(message.file.id)}
                        controls
                        className="w-full h-auto rounded-lg"
                        preload="metadata"
                      >
                        您的浏览器不支持视频播放
                      </video>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs opacity-75 truncate">
                          {message.file.original_name}
                        </p>
                        <p className="text-xs opacity-60">
                          {message.file.size ? formatFileSize(message.file.size) : ''}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload();
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          isCurrentSession
                            ? 'bg-taiji-white text-taiji-black hover:bg-taiji-gray-100'
                            : 'bg-taiji-black text-taiji-white hover:bg-taiji-gray-800'
                        }`}
                      >
                        下载
                      </button>
                    </div>
                  </div>
                );
              }
              
              // 其他文件类型：显示文件图标
              return (
                <div className="flex items-center gap-2 md:gap-3 min-w-[180px] md:min-w-[200px]">
                  <div className="text-2xl md:text-3xl">{getFileIcon(message.file.mimetype)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm md:text-base">
                      {message.file.original_name || '未知文件'}
                    </p>
                    <p className="text-xs opacity-75">
                      {message.file.size ? formatFileSize(message.file.size) : '未知大小'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                    className={`px-2 md:px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isCurrentSession
                        ? 'bg-taiji-white text-taiji-black hover:bg-taiji-gray-100'
                        : 'bg-taiji-black text-taiji-white hover:bg-taiji-gray-800'
                    }`}
                  >
                    下载
                  </button>
                </div>
              );
            })()
          ) : null}
          </div>

          {/* 操作按钮 - 始终渲染，用透明度和指针事件控制 */}
          <div
            className={`flex gap-1 md:gap-2 mt-2 ${isOwn ? 'justify-end' : 'justify-start'} transition-all duration-150 ease-out ${
              showActions
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto'
            }`}
          >
            {/* 复制按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className={`px-2 md:px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? 'bg-green-500 text-white'
                  : isOwn
                  ? 'bg-taiji-gray-700 text-taiji-white hover:bg-taiji-gray-600'
                  : 'bg-taiji-gray-300 text-taiji-black hover:bg-taiji-gray-400'
              }`}
              title="复制"
            >
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>

            {/* 撤回按钮（仅自己的消息） */}
            {isOwn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRecall();
                }}
                className="px-2 md:px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-all"
                title="撤回"
              >
                ↩️ 撤回
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 撤回确认对话框 */}
      <AnimatePresence>
        {showRecallConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={cancelRecall}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-taiji-black mb-2">撤回消息</h3>
                <p className="text-sm text-taiji-gray-600">
                  确定要撤回这条消息吗？
                </p>
              </div>
              <div className="flex border-t border-taiji-gray-200">
                <button
                  onClick={cancelRecall}
                  className="flex-1 py-3 text-sm font-medium text-taiji-gray-600 hover:bg-taiji-gray-50 transition-colors"
                >
                  取消
                </button>
                <div className="w-px bg-taiji-gray-200"></div>
                <button
                  onClick={confirmRecall}
                  className="flex-1 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  撤回
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default ChatMessage;

