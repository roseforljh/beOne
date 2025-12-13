import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
  console.log('[UserRoute] req.user:', req.user);
  const userId = req.user.id;
  console.log('[UserRoute] Looking for userId:', userId);

  db.get(
    'SELECT id, username, email, oauth_provider, oauth_id, is_guest, created_at FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      console.log('[UserRoute] DB result - err:', err, 'user:', user);
      if (err || !user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      res.json(user);
    }
  );
});

// 修改用户名
router.patch('/username', authenticateToken, (req, res) => {
  const { newUsername } = req.body;
  const userId = req.user.id;

  if (!newUsername || newUsername.trim().length < 2) {
    return res.status(400).json({ error: '用户名至少需要2个字符' });
  }

  // 检查用户名是否已存在
  db.get('SELECT * FROM users WHERE username = ? AND id != ?', [newUsername, userId], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: '服务器错误' });
    }

    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 更新用户名
    db.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId], (err) => {
      if (err) {
        return res.status(500).json({ error: '更新失败' });
      }

      res.json({ success: true, username: newUsername });
    });
  });
});

// 修改密码
router.patch('/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '请提供当前密码和新密码' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少需要6个字符' });
  }

  // 验证当前密码
  db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: '服务器错误' });
    }

    try {
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      
      if (!validPassword) {
        return res.status(401).json({ error: '当前密码错误' });
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新密码
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
        if (err) {
          return res.status(500).json({ error: '更新失败' });
        }

        res.json({ success: true, message: '密码修改成功' });
      });
    } catch (error) {
      res.status(500).json({ error: '服务器错误' });
    }
  });
});

// 获取用户信息
router.get('/profile', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get('SELECT id, username, created_at FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user });
  });
});

// 解绑第三方账号
router.post('/unbind-oauth', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get('SELECT oauth_provider FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '服务器错误' });
    }

    if (!user || !user.oauth_provider) {
      return res.status(400).json({ error: '当前账号未绑定第三方登录' });
    }

    db.run(
      'UPDATE users SET oauth_provider = NULL, oauth_id = NULL WHERE id = ?',
      [userId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: '解绑失败' });
        }

        res.json({ success: true, message: '已成功解绑第三方账号' });
      }
    );
  });
});

export default router;