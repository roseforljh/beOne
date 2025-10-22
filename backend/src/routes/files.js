import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const uploadsDir = path.join(__dirname, '../../uploads');

// 辅助函数：检查文件访问权限
const checkFileAccess = (file, req) => {
  // 公开文件都可以访问
  if (file.is_public === 1) {
    return true;
  }

  // 获取 token（从 Header 或查询参数）
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  
  if (!token) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'taiji_secret_key_change_in_production');
    return decoded.id === file.user_id;
  } catch (e) {
    return false;
  }
};

// 获取公开文件列表（无需认证）- 必须在 /:id 路由之前
router.get('/public', (req, res) => {
  db.all(
    'SELECT id, filename, original_name, mimetype, size, created_at FROM files WHERE is_public = 1 ORDER BY created_at DESC',
    [],
    (err, files) => {
      if (err) {
        return res.status(500).json({ error: '获取公开文件列表失败' });
      }

      res.json({ files });
    }
  );
});

// 获取文件列表（需要认证）
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const isGuest = req.user.is_guest;

  // 游客只能看到公共文件
  if (isGuest) {
    db.all(
      'SELECT id, filename, original_name, mimetype, size, is_public, created_at FROM files WHERE is_public = 1 ORDER BY created_at DESC',
      [],
      (err, files) => {
        if (err) {
          return res.status(500).json({ error: '获取文件列表失败' });
        }

        res.json({ files });
      }
    );
  } else {
    // 普通用户看到自己的文件
    db.all(
      'SELECT id, filename, original_name, mimetype, size, is_public, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, files) => {
        if (err) {
          return res.status(500).json({ error: '获取文件列表失败' });
        }

        res.json({ files });
      }
    );
  }
});

// 预览文件（在浏览器中打开，不强制下载）
router.get('/:id/preview', (req, res) => {
  const fileId = parseInt(req.params.id);
  
  console.log('=== 预览请求 ===');
  console.log('文件ID:', fileId);
  console.log('查询参数:', req.query);
  console.log('Headers Authorization:', req.headers['authorization']);

  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err) {
      console.error('数据库查询错误:', err);
      return res.status(500).json({ error: '数据库查询失败' });
    }
    
    if (!file) {
      console.error('文件不存在，ID:', fileId);
      // 列出所有文件ID帮助调试
      db.all('SELECT id, original_name FROM files', [], (err, allFiles) => {
        console.log('数据库中的所有文件:', allFiles);
      });
      return res.status(404).json({ error: '文件不存在' });
    }
    
    console.log('找到文件:', file.original_name, 'mimetype:', file.mimetype);

    // 检查权限
    if (!checkFileAccess(file, req)) {
      console.error('无权访问文件:', fileId, 'is_public:', file.is_public);
      return res.status(403).json({ error: '无权访问此文件' });
    }

    const filePath = file.path;

    if (!fs.existsSync(filePath)) {
      console.error('文件物理路径不存在:', filePath);
      return res.status(404).json({ error: '文件物理文件不存在' });
    }

    console.log('预览文件:', file.original_name, 'mimetype:', file.mimetype);

    // 设置正确的Content-Type，不强制下载
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    
    // 发送文件流
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('文件流错误:', error);
      res.status(500).json({ error: '读取文件失败' });
    });
    fileStream.pipe(res);
  });
});

// 下载文件（强制下载）
router.get('/:id/download', (req, res) => {
  const fileId = req.params.id;

  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 检查权限
    if (!checkFileAccess(file, req)) {
      return res.status(403).json({ error: '无权访问此文件' });
    }

    const filePath = file.path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件物理文件不存在' });
    }

    console.log('下载文件:', file.original_name);
    res.download(filePath, file.original_name);
  });
});

// 获取缩略图
router.get('/:id/thumbnail', (req, res) => {
  const fileId = req.params.id;

  db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 检查权限
    if (!checkFileAccess(file, req)) {
      return res.status(403).json({ error: '无权访问此文件' });
    }

    const thumbPath = path.join(uploadsDir, 'thumbs', file.filename);

    if (fs.existsSync(thumbPath)) {
      res.sendFile(thumbPath);
    } else {
      // 如果缩略图不存在，尝试返回原文件（仅图片）
      if (file.mimetype?.startsWith('image/') && fs.existsSync(file.path)) {
        res.sendFile(file.path);
      } else {
        res.status(404).json({ error: '缩略图不存在' });
      }
    }
  });
});

// 切换文件可见性
router.patch('/:id/visibility', authenticateToken, (req, res) => {
  const fileId = req.params.id;
  const userId = req.user.id;

  db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const newVisibility = file.is_public ? 0 : 1;

    db.run(
      'UPDATE files SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newVisibility, fileId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: '更新失败' });
        }

        // 广播文件更新事件到该用户的所有会话
        const io = req.app.get('io');
        if (io) {
          const roomName = `user_${userId}`;
          console.log('广播文件更新事件到房间:', roomName, '文件ID:', fileId, '可见性:', newVisibility);
          io.to(roomName).emit('file_updated', {
            id: parseInt(fileId),
            is_public: newVisibility
          });
        } else {
          console.error('io 实例不存在，无法广播文件更新事件');
        }

        res.json({ success: true, is_public: newVisibility });
      }
    );
  });
});

// 删除文件
router.delete('/:id', authenticateToken, (req, res) => {
  const fileId = req.params.id;
  const userId = req.user.id;

  db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId], (err, file) => {
    if (err || !file) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 删除物理文件
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // 删除缩略图
    const thumbPath = path.join(uploadsDir, 'thumbs', file.filename);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }

    // 删除数据库记录
    db.run('DELETE FROM files WHERE id = ?', [fileId], (err) => {
      if (err) {
        return res.status(500).json({ error: '删除失败' });
      }

      // 广播文件删除事件到该用户的所有会话
      const io = req.app.get('io');
      if (io) {
        const roomName = `user_${userId}`;
        console.log('广播文件删除事件到房间:', roomName, '文件ID:', fileId);
        io.to(roomName).emit('file_deleted', {
          id: parseInt(fileId)
        });
      } else {
        console.error('io 实例不存在，无法广播文件删除事件');
      }

      res.json({ success: true });
    });
  });
});

export default router;
