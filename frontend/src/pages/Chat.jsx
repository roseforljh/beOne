import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '../utils/api';
import Header from '../components/Header';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import LoadingSpinner from '../components/LoadingSpinner';
import TaijiLogo from '../components/TaijiLogo';
import ConversationSidebar from '../components/ConversationSidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, disconnectSocket } from '../utils/socket';
export default function Chat() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const messagesEndRef = useRef(null);
  const typingTimeouts = useRef(new Map());
  const initialized = useRef(false);
  const chatContainerRef = useRef(null);

  // 使用 useMemo 优化在线用户列表计算
  const mergedOnlineUsers = useMemo(() => {
    return onlineUsers.reduce((acc, user) => {
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
  }, [onlineUsers]);

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  }, []);

  // 优化滚动：使用 requestAnimationFrame
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages, scrollToBottom]);

  const showToastMessage = useCallback((message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  }, []);

  const createNewConversation = useCallback(async () => {
    try {
      const now = new Date();
      const time = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      const response = await axiosInstance.post('/api/conversations', {
        title: `新会话 ${time}`
      });
      return response.data.conversation;
    } catch (error) {
      console.error('创建新会话失败:', error);
      showToastMessage('无法创建新会话，请检查网络并重试', 'error');
      return null;
    }
  }, [showToastMessage]);

  const loadConversations = useCallback(async (selectFirst = false) => {
    try {
      const response = await axiosInstance.get('/api/conversations');
      const fetchedConversations = response.data?.conversations || [];
      setConversations(fetchedConversations);

      if (selectFirst && fetchedConversations.length > 0) {
        setCurrentConversationId(fetchedConversations[0].id);
      } else if (fetchedConversations.length === 0) {
        setCurrentConversationId(null); // 没有会话了，清空当前会话ID
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
      // 出错时设置为空数组，避免后续错误
      setConversations([]);
      setCurrentConversationId(null);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/api/messages?conversation_id=${conversationId}&limit=50`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('加载消息失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const initializeApp = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/api/conversations');
      const fetchedConversations = response.data?.conversations || [];
      setConversations(fetchedConversations);
      if (fetchedConversations.length > 0) {
        setCurrentConversationId(fetchedConversations[0].id);
        // loadMessages 会处理 loading 状态
      } else {
        setCurrentConversationId(null);
        setLoading(false); // 没有会话时，直接设置为 false
      }
    } catch (error) {
      console.error("初始化应用失败:", error);
      // 出错时设置为空数组，避免后续错误
      setConversations([]);
      setCurrentConversationId(null);
      setLoading(false); // 错误时也要设置为 false
    }
  }, []);

  if (!initialized.current) {
    initializeApp();
    initialized.current = true;
  }

  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId, loadMessages]);

  // 监听窗口大小变化（键盘弹出/收起会触发 resize），确保消息滚动到底部
  useEffect(() => {
    const handleResize = () => {
      scrollToBottom();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scrollToBottom]);

  // 定义Socket事件处理函数
  const handleConnect = useCallback((socket) => {
    setCurrentSessionId(socket.id);
  }, []);
  
  const handleNewMessage = useCallback((message) => {
    // 防御：过滤无效消息，避免后续渲染时报 undefined.id
    if (!message || !message.id || !message.conversation_id) return;
    if (message.conversation_id === currentConversationId) {
      setMessages((prev) => [...prev, message]);
    }
  }, [currentConversationId]);
  
  const handleOnlineUsers = useCallback((users) => {
    setOnlineUsers(users);
  }, []);
  
  const handleMessageRecalled = useCallback((data) => {
    setMessages((prev) => prev.filter(msg => msg.id !== data.messageId));
  }, []);
  
  const handleConversationUpdated = useCallback(() => {
    loadConversations();
  }, [loadConversations]);
  
  const handleConversationsUpdated = useCallback((data) => {
    if (data.type === 'created') {
      setConversations(prev => {
        // 防止重复添加（比如本地乐观更新已经添加了）
        if (prev.some(c => c.id === data.conversation.id)) {
          return prev;
        }
        return [data.conversation, ...prev];
      });
    } else if (data.type === 'updated') {
      // 通用更新逻辑，合并 data 中的所有字段
      setConversations(prev =>
        prev.map(c => (String(c.id) === String(data.conversationId) ? { ...c, ...data } : c))
      );
    } else if (data.type === 'deleted') {
      // 如果删除的是当前活动会话
      // 注意：这里需要使用函数式更新时的最新 prev 状态来判断
      setConversations(prev => {
        // 使用 String() 确保类型一致，防止后端传回字符串 ID 而本地是数字 ID
        const remaining = prev.filter(c => String(c.id) !== String(data.conversationId));
        
        // 只有当被删除的会话 ID 等于当前选中的 ID 时，才需要切换
        // 但这里有一个闭包陷阱：currentConversationId 是旧的
        // 所以我们最好在 setConversations 外部判断，或者在 setState 内部逻辑更健壮些
        // 由于我们无法在 setState 内部获取准确的 currentConversationId（它依赖外部闭包），
        // 我们依赖外部的 currentConversationId 依赖项。
        
        if (String(currentConversationId) === String(data.conversationId)) {
           const nextId = remaining.length > 0 ? remaining[0].id : null;
           // 这里调用 setCurrentConversationId 是安全的，但要注意渲染循环
           // 更好的做法是使用 useEffect 监听 conversations 变化来自动修正 selection，
           // 但这里为了简单直接处理
           // 延迟执行以避免在渲染过程中更新状态
           setTimeout(() => setCurrentConversationId(nextId), 0);
        }
        
        return remaining;
      });
    }
  }, [currentConversationId]);

  const handleMessagesCleared = useCallback((data) => {
    console.log('收到清空消息事件:', data);
    console.log('当前会话ID:', currentConversationId);
    console.log('当前用户ID:', user?.id);
    // 如果清空的是当前会话，则清空消息列表
    if (data.conversationId === currentConversationId && data.userId === user?.id) {
      console.log('清空消息列表');
      setMessages([]);
    }
  }, [currentConversationId, user]);

  // Socket连接效果
  useEffect(() => {
    const socket = connectSocket(token);

    const onConnect = () => handleConnect(socket);
    
    socket.on('connect', onConnect);
    socket.on('new_message', handleNewMessage);
    socket.on('online_users', handleOnlineUsers);
    socket.on('message_recalled', handleMessageRecalled);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('conversations_updated', handleConversationsUpdated);
    socket.on('messages_cleared', handleMessagesCleared);
    
    // ... (typing logic remains the same)

    return () => {
      socket.off('connect', onConnect);
      socket.off('new_message', handleNewMessage);
      socket.off('online_users', handleOnlineUsers);
      socket.off('message_recalled', handleMessageRecalled);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('conversations_updated', handleConversationsUpdated);
      socket.off('messages_cleared', handleMessagesCleared);
      disconnectSocket();
    };
  }, [token, handleConnect, handleNewMessage, handleOnlineUsers, handleMessageRecalled, handleConversationUpdated, handleConversationsUpdated, handleMessagesCleared]);

  const handleMessageRecall = (messageId) => {
    setMessages((prev) => prev.filter(msg => msg.id !== messageId));
  };

  const handleClearMessages = () => {
    if (!currentConversationId) return;
    setShowClearConfirm(true);
  };

  const confirmClearMessages = async () => {
    try {
      await axiosInstance.delete(`/api/messages?conversation_id=${currentConversationId}`);
      setMessages([]);
      loadConversations();
      // showToastMessage('聊天记录已清空', 'success');
    } catch (error) {
      console.error('清空失败:', error);
      showToastMessage('清空失败，请重试', 'error');
    }
  };

  const handleSelectConversation = (conversationId) => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await createNewConversation();
      if (newConv) {
        // 手动乐观更新：立即添加到列表顶部，无需等待 WS
        setConversations(prev => {
            // 防止重复（虽然刚创建 ID 应该是唯一的）
            if (prev.some(c => c.id === newConv.id)) return prev;
            return [newConv, ...prev];
        });
        
        setCurrentConversationId(newConv.id);
        // showToastMessage('会话创建成功', 'success');
      }
    } catch (error) {
      console.error('创建会话时出错:', error);
      // createNewConversation 内部已经处理了错误提示，这里不需要重复处理
    }
  };

  // 处理删除会话（乐观更新）
  const handleDeleteConversation = useCallback((conversationId) => {
    console.log('Executing handleDeleteConversation for id:', conversationId);
    setConversations(prev => {
      const remaining = prev.filter(c => c.id !== conversationId);
      return remaining;
    });
    
    // 如果删除的是当前选中的会话，切换到下一个
    if (currentConversationId === conversationId) {
        // 这里我们无法直接获取 filter 后的 remaining，因为那是 setConversations 内部的逻辑
        // 所以我们需要基于当前的 conversations 来计算
        // 注意：这里的 conversations 可能是旧的闭包，但对于计算 nextId 来说，
        // 只要能找到一个非当前 ID 的会话即可。
        
        // 更稳妥的方式：
        setConversations(prev => {
             const remaining = prev.filter(c => c.id !== conversationId);
             const nextId = remaining.length > 0 ? remaining[0].id : null;
             // 直接在这里副作用调用 setCurrentConversationId 是不推荐的，但在事件处理中通常可行
             // 为了避免 warning，我们将 setCurrentConversationId 放在外面或者使用 useEffect
             // 但为了修复 bug，我们先尝试最直接的方式：
             
             // 注意：不能在 setState 回调里调用另一个 setState，这会引起 warning 或逻辑混乱
             // 所以我们应该把 nextId 的计算放在外面
             return remaining;
        });
        
        // 在外面计算 nextId 并设置
        // 注意：这里依赖 conversations 状态，它必须是最新的
        // 由于闭包问题，这里的 conversations 可能不是最新的。
        // 这是一个典型的 React 状态依赖难题。
        
        // 让我们换一种思路：
        // 不在 handleDeleteConversation 里处理 currentConversationId 的切换，
        // 而是交给 useEffect 或者 WebSocket 的 deleted 事件来处理切换。
        // handleDeleteConversation 只负责从列表中移除。
        
        // 但是 WebSocket 有延迟。
        
        // 修正方案：手动计算
        setConversations(currentConversations => {
            const remaining = currentConversations.filter(c => c.id !== conversationId);
            const nextId = remaining.length > 0 ? remaining[0].id : null;
            
            // 在下一次事件循环中切换 ID，确保渲染顺序
            if (currentConversationId === conversationId) {
                 setTimeout(() => setCurrentConversationId(nextId), 0);
            }
            return remaining;
        });
    }
  }, [currentConversationId]);

  // 使用 useMemo 优化标题计算
  const currentConversationTitle = useMemo(() => {
    if (!conversations || !Array.isArray(conversations)) {
      return '加载中...';
    }
    return conversations.find(c => c.id === currentConversationId)?.title || '加载中...';
  }, [conversations, currentConversationId]);

  return (
    <div className="fixed inset-0 bg-taiji-gray-100 flex flex-col" ref={chatContainerRef}>
      {/* Header 作为 Flex 子项，不使用 fixed 定位 */}
      <div className="flex-none z-50">
        <Header fixed={false} />
      </div>

      {/* 内容区域 - 自动占据剩余空间 */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* 桌面端侧边栏 */}
        <div className="hidden lg:block h-full">
          <ConversationSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            onRefresh={loadConversations}
          />
        </div>

        {/* 移动端侧边栏 (抽屉) */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 left-0 bottom-0 z-40 lg:hidden h-full"
              >
                <ConversationSidebar
                  conversations={conversations}
                  currentConversationId={currentConversationId}
                  onSelectConversation={(id) => {
                    handleSelectConversation(id);
                    setIsSidebarOpen(false); // 选择后自动关闭
                  }}
                  onNewConversation={() => {
                    handleNewConversation();
                    setIsSidebarOpen(false); // 新建后自动关闭
                  }}
                  onDeleteConversation={(id) => {
                    handleDeleteConversation(id);
                    setIsSidebarOpen(false); // 删除后自动关闭侧边栏
                  }}
                  onRefresh={loadConversations}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col lg:flex-row md:gap-4 md:p-4">
          <div
            className="flex-1 flex flex-col bg-taiji-white md:rounded-2xl md:shadow-lg md:border-2 border-taiji-gray-200 overflow-hidden"
          >
            <div className="bg-taiji-black text-taiji-white px-3 md:px-6 py-2 md:py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                {/* 移动端汉堡按钮 */}
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 rounded-full hover:bg-white/20 lg:hidden"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                <TaijiLogo size={28} animate={false} className="md:w-8 md:h-8" />
                <div>
                  <h2 className="text-base md:text-xl font-bold">{currentConversationTitle}</h2>
                  <p className="text-xs opacity-75">{mergedOnlineUsers.length} 人在线</p>
                </div>
              </div>
              
              {messages.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClearMessages}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-red-500 hover:bg-red-600 text白 text-xs md:text-sm rounded-lg transition-colors flex items-center gap-1.5"
                  title="清空聊天记录"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="hidden md:inline">清空</span>
                </motion.button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-6">
              {!currentConversationId ? (
                 <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <TaijiLogo size={80} animate={false} className="mx-auto mb-4 opacity-50" />
                      <p className="text-taiji-gray-400">没有会话</p>
                      <p className="text-taiji-gray-400 mt-2">点击左侧“+”按钮创建一个新会话</p>
                    </div>
                  </div>
              ) : loading ? (
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
                    {messages.map((message, index) => (
                      <ChatMessage
                        key={message?.id ?? index}
                        message={message}
                        isOwn={Boolean(user && message && message.user_id === user.id)}
                        currentSessionId={currentSessionId}
                        onRecall={handleMessageRecall}
                      />
                    ))}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <ChatInput conversationId={currentConversationId} />
          </div>

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
                          {onlineUser.username === user.username && <span className="text-xs text-taiji-gray-500 ml-2">(你)</span>}
                          {onlineUser.sessionCount > 1 && <span className="text-xs text-taiji-gray-500 ml-2">({onlineUser.sessionCount}个会话)</span>}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearMessages}
        title="清空聊天记录"
        message="确定要清空当前会话的所有聊天记录吗？此操作不可恢复！"
        confirmText="清空"
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
    </div>
  );
}
