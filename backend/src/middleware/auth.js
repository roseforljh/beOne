import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'taiji_secret_key_change_in_production';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log('[Auth Middleware]', {
    path: req.path,
    method: req.method,
    hasAuthHeader: !!authHeader,
    authHeaderPreview: authHeader ? authHeader.substring(0, 30) + '...' : 'none',
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 30) + '...' : 'none'
  });

  if (!token) {
    console.error('[Auth] ❌ 未提供认证令牌');
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('[Auth] ❌ Token 验证失败:', err.message);
      return res.status(403).json({ error: '令牌无效或已过期', details: err.message });
    }

    console.log('[Auth] ✅ Token 验证成功, 用户:', user.username);
    req.user = user;
    next();
  });
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

