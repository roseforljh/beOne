import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// 游客登录
router.post('/guest-login', async (req, res) => {
  try {
    // 生成唯一的游客用户名
    const guestUsername = `guest_${crypto.randomBytes(8).toString('hex')}`;
    const guestPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(guestPassword, 10);

    db.run(
      'INSERT INTO users (username, password, is_guest) VALUES (?, ?, 1)',
      [guestUsername, hashedPassword],
      function (err) {
        if (err) {
          console.error('创建游客账号失败:', err);
          return res.status(500).json({ error: '创建游客账号失败' });
        }

        const user = {
          id: this.lastID,
          username: guestUsername,
          is_guest: 1
        };

        // 确保使用与认证中间件相同的JWT_SECRET
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables');
          return res.status(500).json({ error: '服务器配置错误' });
        }
        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            is_guest: user.is_guest === 1 || user.is_guest === true
          },
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            is_guest: true
          }
        });
      }
    );
  } catch (error) {
    console.error('游客登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: '服务器错误' });
    }

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 确保使用与认证中间件相同的JWT_SECRET
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables');
        return res.status(500).json({ error: '服务器配置错误' });
      }
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          is_guest: user.is_guest === 1
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          is_guest: user.is_guest === 1
        }
      });
    } catch (error) {
      res.status(500).json({ error: '服务器错误' });
    }
  });
});

// 调试端点 - 验证token
router.post('/debug-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: '未提供token' });
  }

  console.log('[Debug Token] 收到token验证请求:', {
    tokenPreview: token.substring(0, 30) + '...',
    tokenLength: token.length,
    headers: req.headers
  });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('[Debug Token] Token验证失败:', {
        message: err.message,
        expiredAt: err.expiredAt,
        secret: JWT_SECRET.substring(0, 10) + '...'
      });
      return res.status(403).json({
        error: '令牌无效或已过期',
        details: err.message,
        secretPreview: JWT_SECRET.substring(0, 10) + '...'
      });
    }

    console.log('[Debug Token] Token验证成功:', user);
    res.json({
      valid: true,
      user: user,
      secretPreview: JWT_SECRET.substring(0, 10) + '...'
    });
  });
});

export default router;

