import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import passport from '../config/passport.js';

const router = express.Router();

// 游客登录
router.post('/guest-login', async (req, res) => {
  try {
    const guestUsername = `guest_${crypto.randomBytes(8).toString('hex')}`;
    const guestPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(guestPassword, 10);

    db.run(
      'INSERT INTO users (username, password, is_guest) VALUES (?, ?, 1)',
      [guestUsername, hashedPassword],
      function (err) {
        if (err) {
          return res.status(500).json({ error: '创建游客账号失败' });
        }

        const user = {
          id: this.lastID,
          username: guestUsername,
          is_guest: 1
        };

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          return res.status(500).json({ error: '服务器配置错误' });
        }
        
        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            is_guest: true
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

      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
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

// Google OAuth登录
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google登录未配置' });
  }
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { 
    session: false,
    failureRedirect: process.env.FRONTEND_URL || 'http://localhost:5173'
  }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_failed`);
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?token=${user.token}&provider=google`);
  })(req, res, next);
});

// QQ OAuth登录
router.get('/qq', (req, res, next) => {
  if (!process.env.QQ_APP_ID) {
    return res.status(503).json({ error: 'QQ登录未配置' });
  }
  passport.authenticate('qq', { 
    session: false 
  })(req, res, next);
});

router.get('/qq/callback', (req, res, next) => {
  passport.authenticate('qq', { 
    session: false,
    failureRedirect: process.env.FRONTEND_URL || 'http://localhost:5173'
  }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_failed`);
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?token=${user.token}&provider=qq`);
  })(req, res, next);
});

export default router;