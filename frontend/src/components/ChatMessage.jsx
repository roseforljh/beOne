import { useState, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatFileSize, getFileIcon } from '../utils/uploadHelper';
import { api } from '../utils/api';
import { recallMessage } from '../utils/socket';

const ChatMessage = memo(function ChatMessage({ message, isOwn, currentSessionId, onRecall }) {
  // 判断是否是当前会话发送的消息
  // 如果消息没有 session_id（旧消息），默认显示在右边
  const isCurrentSession = !message.session_id || message.session_id === currentSessionId;
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = useCallback(() => {
    if (message.file) {
      window.open(api.getDownloadUrl(message.file.id), '_blank');
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
    if (confirm('确定要撤回这条消息吗？')) {
      recallMessage(message.id);
      if (onRecall) {
        onRecall(message.id);
      }
    }
  }, [message.id, onRecall]);

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
            className={`px-3 md:px-4 py-2 md:py-3 rounded-2xl text-sm md:text-base ${
              isCurrentSession
                ? 'bg-taiji-black text-taiji-white'
                : 'bg-taiji-gray-200 text-taiji-black'
            }`}
          >
          {message.type === 'text' ? (
            <p className="whitespace-pre-wrap break-all">{message.content}</p>
          ) : message.type === 'file' && message.file ? (
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
                  isOwn
                    ? 'bg-taiji-white text-taiji-black hover:bg-taiji-gray-100'
                    : 'bg-taiji-black text-taiji-white hover:bg-taiji-gray-800'
                }`}
              >
                下载
              </button>
            </div>
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
    </motion.div>
  );
});

export default ChatMessage;

