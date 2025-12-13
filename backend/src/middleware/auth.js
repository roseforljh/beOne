import jwt from 'jsonwebtoken';

// 确保JWT_SECRET在所有环境下都一致
const JWT_SECRET = process.env.JWT_SECRET || 'taiji_secret_key_change_in_production';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }

    console.log('[Auth] Token payload:', user);
    req.user = user;
    next();
  });
};

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      is_guest: user.is_guest === 1 || user.is_guest === true
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};