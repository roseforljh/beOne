import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

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
    function(err) {
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

      // 删除会话（消息会因为 ON DELETE CASCADE 自动删除）
      db.run('DELETE FROM conversations WHERE id = ?', [conversationId], (err) => {
        if (err) {
          return res.status(500).json({ error: '删除失败' });
        }

        // 广播会话更新事件
        const io = req.app.get('io');
        io.to(`user_${userId}`).emit('conversations_updated', { type: 'deleted', conversationId });

        res.json({ success: true });
      });
    }
  );
});

export default router;