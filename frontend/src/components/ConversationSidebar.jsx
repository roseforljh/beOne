import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance as axios } from '../utils/api';  // 统一使用带拦截器的实例，确保携带 token

export default function ConversationSidebar({ 
  conversations, 
  currentConversationId, 
  onSelectConversation, 
  onNewConversation,
  onDeleteConversation,
  onRefresh
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  // 自定义确认弹窗状态
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const handleRename = async (id) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      // 乐观更新：先本地改标题（通过父组件回调或直接修改本地状态）
      // 注意：这里我们不再调用 onRefresh，而是依赖父组件的乐观更新逻辑或 ws 推送
      const newTitle = editTitle;
      setEditingId(null);
      
      // 立即更新 UI（如果父组件支持，或者这里我们只是发起请求，让 WS 来更新）
      // 但为了更好的体验，我们应该通知父组件进行乐观更新，这里简化为发起请求，
      // 依赖 WS 或父组件的 handleConversationsUpdated 来更新 UI
      
      await axios.patch(`/api/conversations/${id}`, { title: newTitle });
    } catch (error) {
      // 失败时，WS 不会推送更新，UI 会保持原样（或者如果做了乐观更新需要回滚）
      // 这里简单处理，如果失败了，用户刷新页面会恢复
      console.error('重命名失败:', error);
      // 如果失败，尝试刷新以恢复正确状态
      onRefresh();
    }
  };

  const openConfirmDelete = (id) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    
    // 关闭弹窗
    closeConfirm();
    
    try {
      // 乐观更新：先通知父组件移除会话
      if (onDeleteConversation) {
        onDeleteConversation(id);
      }

      await axios.delete(`/api/conversations/${id}`);
      
      // 双重保险：虽然我们做了乐观更新，但为了防止万一状态没更新（比如父组件回调有问题），
      // 我们还是在成功后刷新一下列表。由于后端现在很快（异步删除），这个刷新也会很快。
      // 这能彻底解决“必须切换页面才消失”的顽固 bug。
      onRefresh();
      
    } catch (error) {
      console.error('删除失败:', error);
      onRefresh();
    }
  };

  const handleNewConversation = async () => {
    setIsCreating(true);
    try {
      // 不再直接调用 API，而是通过回调通知父组件处理
      await onNewConversation();
    } catch (error) {
      console.error('创建会话失败:', error);
      // 移除alert，错误处理由父组件的Toast负责
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-64 bg-taiji-white border-r-2 border-taiji-gray-200 flex flex-col h-full">
      {/* 标题和新建按钮 */}
      <div className="p-4 border-b-2 border-taiji-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-taiji-black">会话列表</h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNewConversation}
            disabled={isCreating}
            className="p-2 bg-taiji-black text-taiji-white rounded-lg hover:bg-taiji-gray-800 transition-colors disabled:opacity-50"
            title="新建会话"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence>
          {conversations.map((conv) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                currentConversationId === conv.id
                  ? 'bg-taiji-black text-taiji-white'
                  : 'bg-taiji-gray-100 hover:bg-taiji-gray-200'
              }`}
            >
              {editingId === conv.id ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleRename(conv.id)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleRename(conv.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="w-full px-2 py-1 text-sm bg-taiji-white text-taiji-black border border-taiji-gray-300 rounded"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div onClick={() => onSelectConversation(conv.id)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate flex-1">
                      {conv.title}
                    </span>
                    <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(conv.id);
                          setEditTitle(conv.title);
                        }}
                        className="p-1 hover:bg-taiji-gray-300 rounded"
                        title="重命名"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfirmDelete(conv.id);
                        }}
                        className="p-1 hover:bg-red-500 hover:text-white rounded"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs opacity-75">
                    <span>{conv.message_count || 0} 条消息</span>
                    <span>{new Date(conv.updated_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {conversations.length === 0 && (
          <div className="text-center py-8 text-taiji-gray-400 text-sm">
            暂无历史会话
            <br />
            点击上方 + 创建新会话
          </div>
        )}
      </div>

      {/* 自定义确认弹窗（替代系统 confirm） */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeConfirm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-80 rounded-xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b">
                <h3 className="text-base font-semibold text-taiji-black">确认删除</h3>
              </div>
              <div className="px-5 py-4 text-sm text-taiji-gray-700">
                确定要删除这个会话吗？所有消息将被删除！
              </div>
              <div className="px-5 py-3 border-t flex justify-end gap-3">
                <button
                  onClick={closeConfirm}
                  className="px-3 py-1.5 rounded-lg border border-taiji-gray-300 text-taiji-black hover:bg-taiji-gray-100"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}