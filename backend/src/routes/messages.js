import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

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

// 删除消息（撤回消息）
router.delete('/:id', authenticateToken, (req, res) => {
  const messageId = req.params.id;
  const userId = req.user.id;

  // 验证消息所有权
  db.get('SELECT * FROM messages WHERE id = ? AND user_id = ?', [messageId, userId], (err, message) => {
    if (err || !message) {
      return res.status(404).json({ error: '消息不存在或无权删除' });
    }

    // 先响应客户端
    res.json({ success: true });

    // 删除消息
    db.run('DELETE FROM messages WHERE id = ?', [messageId], () => {});

    // 异步删除关联文件
    if (message.file_id) {
      setImmediate(() => {
        db.get('SELECT * FROM files WHERE id = ?', [message.file_id], (err, file) => {
          if (!err && file && file.source === 'chat') {
            // 删除物理文件
            if (fs.existsSync(file.path)) {
              fs.unlink(file.path, () => {});
            }

            // 删除缩略图
            const thumbPath = path.join(uploadsDir, 'thumbs', file.filename);
            if (fs.existsSync(thumbPath)) {
              fs.unlink(thumbPath, () => {});
            }

            // 删除小缩略图
            const smallThumbPath = thumbPath.replace(path.extname(thumbPath), '_small' + path.extname(thumbPath));
            if (fs.existsSync(smallThumbPath)) {
              fs.unlink(smallThumbPath, () => {});
            }

            // 删除文件记录
            db.run('DELETE FROM files WHERE id = ?', [message.file_id], () => {});
          }
        });
      });
    }
  });
});

// 清空消息历史（支持按会话ID清空）
router.delete('/', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const conversationId = req.query.conversation_id;

  if (!conversationId) {
    return res.status(400).json({ error: '会话 ID 不能为空' });
  }

  // 先响应客户端
  res.json({ success: true });

  // 删除消息
  db.run('DELETE FROM messages WHERE user_id = ? AND conversation_id = ?', [userId, conversationId], () => {
    // 更新会话时间戳
    db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId], () => {});
  });

  // 广播事件
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${userId}`).emit('messages_cleared', { userId, conversationId });
    io.to(`user_${userId}`).emit('conversations_updated', {
      type: 'updated',
      conversationId,
      message_count: 0,
      updated_at: new Date().toISOString()
    });
  }

  // 异步清理文件
  setImmediate(() => {
    db.all(
      'SELECT m.file_id, f.* FROM messages m LEFT JOIN files f ON m.file_id = f.id WHERE m.user_id = ? AND m.conversation_id = ? AND m.file_id IS NOT NULL',
      [userId, conversationId],
      (err, fileMessages) => {
        if (err || !fileMessages) return;

        fileMessages.forEach(file => {
          if (file && file.source === 'chat') {
            if (file.path && fs.existsSync(file.path)) {
              fs.unlink(file.path, () => {});
            }

            if (file.filename) {
              const thumbPath = path.join(uploadsDir, 'thumbs', file.filename);
              if (fs.existsSync(thumbPath)) {
                fs.unlink(thumbPath, () => {});
              }
              const smallThumbPath = thumbPath.replace(path.extname(thumbPath), '_small' + path.extname(thumbPath));
              if (fs.existsSync(smallThumbPath)) {
                fs.unlink(smallThumbPath, () => {});
              }
            }

            db.run('DELETE FROM files WHERE id = ?', [file.id], () => {});
          }
        });
      }
    );
  });
});

export default router;

