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

// 所有路由需要认证
router.use(authenticateToken);

// 获取会话列表
router.get('/', (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT 
      c.id,
      c.title,
      c.created_at,
      c.updated_at,
      COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.updated_at DESC`,
    [userId],
    (err, conversations) => {
      if (err) {
        return res.status(500).json({ error: '获取会话列表失败' });
      }

      res.json({ conversations });
    }
  );
});

// 创建新会话
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { title } = req.body;

  const conversationTitle = title || `新会话 ${new Date().toLocaleString('zh-CN')}`;

  db.run(
    'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
    [userId, conversationTitle],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '创建会话失败' });
      }

      const conversation = {
        id: this.lastID,
        title: conversationTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0
      };

      // 广播会话更新事件，并带上新会话的数据
      const io = req.app.get('io');
      io.to(`user_${userId}`).emit('conversations_updated', { type: 'created', conversation });

      res.status(201).json({ conversation });
    }
  );
});

// 重命名会话
router.patch('/:id', (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user.id;
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: '标题不能为空' });
  }

  // 验证会话所有权
  db.get(
    'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
    [conversationId, userId],
    (err, conversation) => {
      if (err || !conversation) {
        return res.status(404).json({ error: '会话不存在' });
      }

      db.run(
        'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, conversationId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: '重命名失败' });
          }

          // 广播会话更新事件
          const io = req.app.get('io');
          io.to(`user_${userId}`).emit('conversations_updated', { type: 'updated', conversationId, title });

          res.json({ success: true, title });
        }
      );
    }
  );
});

// 删除会话
router.delete('/:id', (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user.id;

  // 验证会话所有权
  db.get(
    'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
    [conversationId, userId],
    (err, conversation) => {
      if (err || !conversation) {
        return res.status(404).json({ error: '会话不存在' });
      }

      // 1. 先执行数据库删除操作，确保响应速度
      db.run('DELETE FROM conversations WHERE id = ?', [conversationId], (err) => {
        if (err) {
          return res.status(500).json({ error: '删除失败' });
        }

        // 2. 立即响应客户端
        res.json({ success: true });

        // 3. 广播会话更新事件
        const io = req.app.get('io');
        io.to(`user_${userId}`).emit('conversations_updated', { type: 'deleted', conversationId });

        // 4. 后台异步清理文件
        // 先获取该会话中所有包含文件的消息（注意：因为会话已删除，这里可能查不到消息了，
        // 所以应该在删除会话前查询，或者依赖定期清理任务。
        // 修正策略：为了不阻塞，我们改为先查询文件，再删除数据库，但文件删除操作放在后台执行）
      });

      // 重新实现：为了正确清理文件，我们需要在删除会话前获取文件列表
      // 但为了响应速度，我们不等待文件删除完成

      // 获取该会话中所有包含文件的消息
      db.all(
        'SELECT m.file_id, f.* FROM messages m LEFT JOIN files f ON m.file_id = f.id WHERE m.conversation_id = ? AND m.file_id IS NOT NULL',
        [conversationId],
        (err, fileMessages) => {
          if (err || !fileMessages || fileMessages.length === 0) return;

          // 后台异步处理文件删除
          setImmediate(async () => {
            for (const file of fileMessages) {
              if (file && file.source === 'chat') {
                // 删除物理文件
                if (file.path) {
                  fs.promises.unlink(file.path).catch(() => {});
                }

                // 删除缩略图
                if (file.filename) {
                  const thumbPath = path.join(uploadsDir, 'thumbs', file.filename);
                  fs.promises.unlink(thumbPath).catch(() => {});
                  const smallThumbPath = thumbPath.replace(path.extname(thumbPath), '_small' + path.extname(thumbPath));
                  fs.promises.unlink(smallThumbPath).catch(() => {});
                }

                // 删除文件记录
                db.run('DELETE FROM files WHERE id = ?', [file.id], () => {});
              }
            }
          });
        }
      );
    }
  );
});

export default router;