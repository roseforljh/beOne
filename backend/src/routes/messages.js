import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 获取消息历史（支持按会话ID筛选）
router.get('/', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const userId = req.user.id;
  const conversationId = req.query.conversation_id;

  // 如果没有提供 conversation_id，则返回空消息数组，不再查询默认消息
  if (!conversationId) {
    return res.json({ messages: [] });
  }

  const query = `SELECT
    m.id,
    m.user_id,
    m.conversation_id,
    u.username,
    m.type,
    m.content,
    m.file_id,
    m.session_id,
    m.created_at,
    f.filename,
    f.original_name,
    f.mimetype,
    f.size
  FROM messages m
  LEFT JOIN users u ON m.user_id = u.id
  LEFT JOIN files f ON m.file_id = f.id
  WHERE m.user_id = ? AND m.conversation_id = ?
  ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;

  const params = [userId, conversationId, limit, offset];

  db.all(query, params, (err, messages) => {
    if (err) {
      return res.status(500).json({ error: '获取消息失败' });
    }

    // 格式化消息
    const formattedMessages = messages.map(msg => {
      const message = {
        id: msg.id,
        user_id: msg.user_id,
        conversation_id: msg.conversation_id,
        username: msg.username,
        type: msg.type,
        session_id: msg.session_id,
        created_at: msg.created_at
      };

      if (msg.type === 'text') {
        message.content = msg.content;
      } else if (msg.type === 'file' && msg.file_id) {
        message.file = {
          id: msg.file_id,
          filename: msg.filename,
          original_name: msg.original_name,
          mimetype: msg.mimetype,
          size: msg.size
        };
      }

      return message;
    });

    res.json({ messages: formattedMessages.reverse() });
  });
});

// 删除消息
router.delete('/:id', authenticateToken, (req, res) => {
  const messageId = req.params.id;
  const userId = req.user.id;

  // 验证消息所有权
  db.get('SELECT * FROM messages WHERE id = ? AND user_id = ?', [messageId, userId], (err, message) => {
    if (err || !message) {
      return res.status(404).json({ error: '消息不存在或无权删除' });
    }

    db.run('DELETE FROM messages WHERE id = ?', [messageId], (err) => {
      if (err) {
        return res.status(500).json({ error: '删除失败' });
      }

      res.json({ success: true });
    });
  });
});

// 清空消息历史（支持按会话ID清空）
router.delete('/', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const conversationId = req.query.conversation_id;

  // We must have a conversation ID to clear messages.
  if (!conversationId) {
    return res.status(400).json({ error: '会话 ID 不能为空' });
  }

  const query = 'DELETE FROM messages WHERE user_id = ? AND conversation_id = ?';
  const params = [userId, conversationId];

  db.run(query, params, (err) => {
    if (err) {
      return res.status(500).json({ error: '清空失败' });
    }

    res.json({ success: true });
  });
});

export default router;

