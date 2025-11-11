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

    // 如果消息包含文件，检查文件来源并删除会话文件
    if (message.file_id) {
      db.get('SELECT * FROM files WHERE id = ?', [message.file_id], (err, file) => {
        if (!err && file && file.source === 'chat') {
          // 删除物理文件
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          // 删除缩略图
          const thumbPath = path.join(uploadsDir, 'thumbs', file.filename);
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
          }

          // 删除小缩略图
          const smallThumbPath = thumbPath.replace(path.extname(thumbPath), '_small' + path.extname(thumbPath));
          if (fs.existsSync(smallThumbPath)) {
            fs.unlinkSync(smallThumbPath);
          }

          // 删除文件记录
          db.run('DELETE FROM files WHERE id = ?', [message.file_id], (err) => {
            if (err) {
              console.error('删除会话文件记录失败:', err);
            }
          });
        }
      });
    }

    // 删除消息
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

  // 先获取该会话中所有包含文件的消息
  db.all(
    'SELECT m.file_id, f.* FROM messages m LEFT JOIN files f ON m.file_id = f.id WHERE m.user_id = ? AND m.conversation_id = ? AND m.file_id IS NOT NULL',
    [userId, conversationId],
    (err, fileMessages) => {
      if (err) {
        console.error('查询会话文件失败:', err);
      }

      // 删除所有会话文件（source='chat'）
      if (fileMessages && fileMessages.length > 0) {
        fileMessages.forEach(file => {
          if (file && file.source === 'chat') {
            // 删除物理文件
            if (file.path && fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }

            // 删除缩略图
            if (file.filename) {
              const thumbPath = path.join(uploadsDir, 'thumbs', file.filename);
              if (fs.existsSync(thumbPath)) {
                fs.unlinkSync(thumbPath);
              }

              const smallThumbPath = thumbPath.replace(path.extname(thumbPath), '_small' + path.extname(thumbPath));
              if (fs.existsSync(smallThumbPath)) {
                fs.unlinkSync(smallThumbPath);
              }
            }

            // 删除文件记录
            db.run('DELETE FROM files WHERE id = ?', [file.id], (err) => {
              if (err) {
                console.error('删除会话文件记录失败:', err);
              }
            });
          }
        });
      }

      // 删除消息
      const query = 'DELETE FROM messages WHERE user_id = ? AND conversation_id = ?';
      const params = [userId, conversationId];

      db.run(query, params, (err) => {
        if (err) {
          return res.status(500).json({ error: '清空失败' });
        }

        // 更新会话的 updated_at 时间戳
        db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId], (updateErr) => {
          const io = req.app.get('io');
          if (io) {
            // 通知该用户的所有会话（手机和电脑）消息已清空
            io.to(`user_${userId}`).emit('messages_cleared', {
              userId: userId,
              conversationId: conversationId
            });
            
            // 通知该用户的所有会话更新会话列表（更新消息数量）
            io.to(`user_${userId}`).emit('conversations_updated', {
              type: 'updated',
              conversationId: conversationId,
              // 消息清空后，消息数为 0
              message_count: 0,
              updated_at: new Date().toISOString()
            });
          }

          res.json({ success: true });
        });
      });
    }
  );
});

export default router;

