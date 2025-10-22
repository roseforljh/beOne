import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
      function(err) {
        if (err) {
          console.error('创建游客账号失败:', err);
          return res.status(500).json({ error: '创建游客账号失败' });
        }
        
        const user = {
          id: this.lastID,
          username: guestUsername,
          is_guest: 1
        };
        
        const token = generateToken(user);
        
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

      const token = generateToken(user);

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

export default router;

