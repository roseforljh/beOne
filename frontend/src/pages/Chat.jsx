import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Header from '../components/Header';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import LoadingSpinner from '../components/LoadingSpinner';
import TaijiLogo from '../components/TaijiLogo';
import ConversationSidebar from '../components/ConversationSidebar';
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
  const messagesEndRef = useRef(null);
  const typingTimeouts = useRef(new Map());
  const initialized = useRef(false);

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

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewConversation = useCallback(async () => {
    try {
      const now = new Date();
      const time = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      const response = await axios.post('/api/conversations', {
        title: `新会话 ${time}`
      });
      return response.data.conversation;
    } catch (error) {
      console.error('创建新会话失败:', error);
      alert('无法创建新会话，请检查网络并重试。');
      return null;
    }
  }, []);

  const loadConversations = useCallback(async (selectFirst = false) => {
    try {
      const response = await axios.get('/api/conversations');
      const fetchedConversations = response.data.conversations;
      setConversations(fetchedConversations);

      if (selectFirst && fetchedConversations.length > 0) {
        setCurrentConversationId(fetchedConversations[0].id);
      } else if (fetchedConversations.length === 0) {
        setCurrentConversationId(null); // 没有会话了，清空当前会话ID
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
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
      const response = await axios.get(`/api/messages?conversation_id=${conversationId}&limit=50`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('加载消息失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const initializeApp = useCallback(async () => {
    try {
      const response = await axios.get('/api/conversations');
      const fetchedConversations = response.data.conversations;
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

  useEffect(() => {
    const socket = connectSocket(token);

    const handleConnect = () => setCurrentSessionId(socket.id);
    const handleNewMessage = (message) => {
      if (message.conversation_id === currentConversationId) {
        setMessages((prev) => [...prev, message]);
      }
    };
    const handleOnlineUsers = (users) => setOnlineUsers(users);
    const handleMessageRecalled = (data) => setMessages((prev) => prev.filter(msg => msg.id !== data.messageId));
    
    // 新增：处理会话更新事件（实时刷新会话列表）
    const handleConversationUpdated = (data) => {
      // 立即刷新会话列表，确保所有端都能看到最新的会话顺序
      loadConversations();
    };
    
    const handleConversationsUpdated = (data) => {
      if (data.type === 'created') {
        setConversations(prev => [data.conversation, ...prev]);
      } else if (data.type === 'updated') {
        setConversations(prev =>
          prev.map(c => c.id === data.conversationId ? { ...c, title: data.title } : c)
        );
      } else if (data.type === 'deleted') {
        setConversations(prev => prev.filter(c => c.id !== data.conversationId));
        // 如果删除的是当前会话，则切换到第一个
        if (currentConversationId === data.conversationId) {
            const remainingConversations = conversations.filter(c => c.id !== data.conversationId);
            if(remainingConversations.length > 0) {
                setCurrentConversationId(remainingConversations[0].id);
            } else {
                setCurrentConversationId(null);
            }
        }
      }
    };

    socket.on('connect', handleConnect);
    socket.on('new_message', handleNewMessage);
    socket.on('online_users', handleOnlineUsers);
    socket.on('message_recalled', handleMessageRecalled);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('conversations_updated', handleConversationsUpdated);
    
    // ... (typing logic remains the same)

    return () => {
      socket.off('connect', handleConnect);
      socket.off('new_message', handleNewMessage);
      socket.off('online_users', handleOnlineUsers);
      socket.off('message_recalled', handleMessageRecalled);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('conversations_updated', handleConversationsUpdated);
      disconnectSocket();
    };
  }, [token, currentConversationId, loadConversations]);

  const handleMessageRecall = (messageId) => {
    setMessages((prev) => prev.filter(msg => msg.id !== messageId));
  };

  const handleClearMessages = async () => {
    if (!currentConversationId) return;
    if (!window.confirm('确定要清空当前会话的聊天记录吗？此操作不可恢复！')) return;

    try {
      await axios.delete(`/api/messages?conversation_id=${currentConversationId}`);
      setMessages([]);
      loadConversations();
      alert('聊天记录已清空');
    } catch (error) {
      console.error('清空失败:', error);
      alert('清空失败，请重试');
    }
  };

  const handleSelectConversation = (conversationId) => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
    }
  };

  const handleNewConversation = async () => {
    const newConv = await createNewConversation();
    if (newConv) {
      // 后端会通过 websocket 通知我们更新列表，
      // 我们只需要在操作端将会话切换到新建的这个
      setCurrentConversationId(newConv.id);
    }
  };

  const currentConversationTitle = conversations.find(c => c.id === currentConversationId)?.title || '加载中...';

  return (
    <div className="fixed inset-0 bg-taiji-gray-100 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 桌面端侧边栏 */}
        <div className="hidden lg:block">
          <ConversationSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
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
                className="fixed top-0 left-0 h-full z-40 lg:hidden"
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
                  onRefresh={loadConversations}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col lg:flex-row gap-2 md:gap-4 p-2 md:p-4">
          <div className="flex-1 flex flex-col bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 overflow-hidden">
            <div className="bg-taiji-black text-taiji-white px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
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
    </div>
  );
}
