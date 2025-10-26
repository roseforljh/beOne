import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Header from '../components/Header';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import LoadingSpinner from '../components/LoadingSpinner';
import TaijiLogo from '../components/TaijiLogo';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../utils/socket';

export default function Chat() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeouts = useRef(new Map());

  // 合并在线用户（按用户名分组）
  const mergedOnlineUsers = onlineUsers.reduce((acc, user) => {
    const existing = acc.find(u => u.username === user.username);
    if (existing) {
      existing.sessionCount += 1;
    } else {
      acc.push({
        username: user.username,
        sessionCount: 1,
        connectedAt: user.connectedAt
      });
    }
    return acc;
  }, []);

  // 滚动到底部
  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  };

  // 首次加载标记
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // 首次加载时立即滚动到底部，不使用动画
    if (isFirstLoad.current && messages.length > 0) {
      scrollToBottom(true);
      isFirstLoad.current = false;
    } else if (!isFirstLoad.current) {
      // 后续新消息使用平滑滚动
      scrollToBottom(false);
    }
  }, [messages]);

  useEffect(() => {
    // 加载历史消息
    const loadMessages = async () => {
      try {
        const response = await axios.get('/api/messages');
        setMessages(response.data.messages);
      } catch (error) {
        console.error('加载消息失败:', error);
      }
      setLoading(false);
    };

    // 连接 Socket
    const socket = connectSocket(token);

    // 定义事件处理函数
    const handleConnect = () => {
      console.log('Socket 连接成功，会话ID:', socket.id);
      setCurrentSessionId(socket.id);
      
      // 只在首次连接时加载消息
      loadMessages();
    };

    const handleNewMessage = (message) => {
      console.log('收到新消息:', {
        content: message.content || '文件',
        messageSessionId: message.session_id,
        currentSessionId: socket.id,
        isMatch: message.session_id === socket.id
      });
      setMessages((prev) => {
        // 检查消息是否已存在，避免重复
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    };

    const handleOnlineUsers = (users) => {
      console.log('收到在线用户列表:', users);
      setOnlineUsers(users);
    };

    const handleOnlineUsersUpdate = (users) => {
      if (user.username === 'root') {
        console.log('更新在线用户列表:', users);
        setOnlineUsers(users);
      }
    };

    // 注册事件监听器
    socket.on('connect', handleConnect);
    socket.on('new_message', handleNewMessage);
    socket.on('online_users', handleOnlineUsers);
    socket.on('online_users_update', handleOnlineUsersUpdate);

    // 监听用户正在输入
    socket.on('user_typing', (data) => {
      setTypingUsers((prev) => new Set([...prev, data.userId]));
      
      // 清除之前的超时
      if (typingTimeouts.current.has(data.userId)) {
        clearTimeout(typingTimeouts.current.get(data.userId));
      }
      
      // 3秒后自动移除输入状态
      const timeout = setTimeout(() => {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        typingTimeouts.current.delete(data.userId);
      }, 3000);
      
      typingTimeouts.current.set(data.userId, timeout);
    });

    // 监听用户停止输入
    socket.on('user_stop_typing', (data) => {
      if (typingTimeouts.current.has(data.userId)) {
        clearTimeout(typingTimeouts.current.get(data.userId));
        typingTimeouts.current.delete(data.userId);
      }
      
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });

    // 监听错误
    socket.on('error', (error) => {
      console.error('Socket 错误:', error);
      alert(error.message);
    });

    const handleMessageRecalled = (data) => {
      console.log('收到撤回事件，消息ID:', data.messageId);
      setMessages((prev) => {
        const filtered = prev.filter(msg => msg.id !== data.messageId);
        console.log('撤回前消息数:', prev.length, '撤回后:', filtered.length);
        return filtered;
      });
    };

    socket.on('message_recalled', handleMessageRecalled);

    // 清理函数
    return () => {
      // 移除所有事件监听器
      socket.off('connect', handleConnect);
      socket.off('new_message', handleNewMessage);
      socket.off('online_users', handleOnlineUsers);
      socket.off('online_users_update', handleOnlineUsersUpdate);
      socket.off('message_recalled', handleMessageRecalled);
      
      // 清理定时器
      typingTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      
      // 断开连接
      disconnectSocket();
    };
  }, [token, user.username]);

  const handleMessageRecall = (messageId) => {
    // 本地立即移除消息（乐观更新）
    setMessages((prev) => prev.filter(msg => msg.id !== messageId));
  };

  // 清空聊天记录
  const handleClearMessages = async () => {
    if (!window.confirm('确定要清空所有聊天记录吗？此操作不可恢复！')) {
      return;
    }

    try {
      await axios.delete('/api/messages');
      setMessages([]);
      alert('聊天记录已清空');
    } catch (error) {
      console.error('清空失败:', error);
      alert('清空失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-taiji-gray-100 flex flex-col">
      <Header />

      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row gap-2 md:gap-4 p-2 md:p-4">
        {/* 主对话区域 */}
        <div className="flex-1 flex flex-col bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 overflow-hidden">
          {/* 对话标题 */}
          <div className="bg-taiji-black text-taiji-white px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <TaijiLogo size={28} animate={false} className="md:w-8 md:h-8" />
              <div>
                <h2 className="text-base md:text-xl font-bold">实时对话板</h2>
                <p className="text-xs opacity-75">
                  {mergedOnlineUsers.length} 人在线
                </p>
              </div>
            </div>
            
            {/* 清空按钮 */}
            {messages.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClearMessages}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-red-500 hover:bg-red-600 text-white text-xs md:text-sm rounded-lg transition-colors flex items-center gap-1.5"
                title="清空聊天记录"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden md:inline">清空</span>
              </motion.button>
            )}
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-3 md:p-6">
            {loading ? (
              <LoadingSpinner message="加载消息..." />
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <TaijiLogo size={80} animate={true} className="mx-auto mb-4" />
                  <p className="text-taiji-gray-400">暂无消息，开始聊天吧</p>
                </div>
              </div>
            ) : (
              <>
                <AnimatePresence>
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isOwn={message.user_id === user.id}
                      currentSessionId={currentSessionId}
                      onRecall={handleMessageRecall}
                    />
                  ))}
                </AnimatePresence>

                {/* 正在输入提示 */}
                {typingUsers.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center gap-2 text-taiji-gray-500 text-sm px-2"
                  >
                    <div className="flex gap-1">
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                      >
                        •
                      </motion.span>
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                      >
                        •
                      </motion.span>
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                      >
                        •
                      </motion.span>
                    </div>
                    <span>有人正在输入...</span>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 输入区域 */}
          <ChatInput />
        </div>

        {/* 在线用户列表（桌面端）- 只有 root 用户可见 */}
        {user.username === 'root' && (
          <div className="hidden lg:block w-64 bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 p-4">
            <h3 className="text-base md:text-lg font-bold text-taiji-black mb-4">在线用户</h3>
            
            {mergedOnlineUsers.length === 0 ? (
              <p className="text-sm text-taiji-gray-400 text-center py-8">暂无在线用户</p>
            ) : (
              <div className="space-y-2">
                {mergedOnlineUsers.map((onlineUser, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-taiji-gray-100 hover:bg-taiji-gray-200 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-taiji-black truncate">
                        {onlineUser.username}
                        {onlineUser.username === user.username && (
                          <span className="text-xs text-taiji-gray-500 ml-2">(你)</span>
                        )}
                        {onlineUser.sessionCount > 1 && (
                          <span className="text-xs text-taiji-gray-500 ml-2">
                            ({onlineUser.sessionCount}个会话)
                          </span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 在线用户列表（移动端）- 只有 root 用户可见 */}
        {user.username === 'root' && (
          <div className="lg:hidden bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 p-3 md:p-4">
            <h3 className="text-base md:text-lg font-bold text-taiji-black mb-3">
              在线用户 ({mergedOnlineUsers.length})
            </h3>
            
            {mergedOnlineUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mergedOnlineUsers.map((onlineUser, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-taiji-gray-100"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-taiji-black">
                      {onlineUser.username}
                      {onlineUser.username === user.username && ' (你)'}
                      {onlineUser.sessionCount > 1 && ` (${onlineUser.sessionCount})`}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

