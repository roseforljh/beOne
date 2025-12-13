import './config/env.js';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import compression from 'compression';
import session from 'express-session';
import cluster from 'cluster';
import os from 'os';
import { initDatabase } from './config/database.js';
import { initSocket } from './config/socket.js';
import { cacheMiddleware } from './middleware/cache.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import filesRoutes from './routes/files.js';
import messagesRoutes from './routes/messages.js';
import userRoutes from './routes/user.js';
import conversationsRoutes from './routes/conversations.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// 性能优化中间件
// 1. 启用 gzip 压缩（优化：降低压缩级别减少 CPU 开销）
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // 平衡压缩级别，减少 CPU 开销
  threshold: 1024 // 只压缩大于 1KB 的响应
}));

// 2. CORS 配置优化
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  maxAge: 86400 // 预检请求缓存24小时
}));

// 3. JSON 解析优化
app.use(express.json({
  limit: '50gb',
  strict: true
}));

app.use(express.urlencoded({
  extended: true,
  limit: '50gb',
  parameterLimit: 50000
}));

// 4. 响应头优化
app.use((req, res, next) => {
  // 安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 缓存控制
  if (req.method === 'GET' && req.path.startsWith('/api/files/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  next();
});

// 5. 请求日志已移除以提高性能

// Session配置（OAuth需要）
if (process.env.SESSION_SECRET) {
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }));

  const passport = await import('./config/passport.js');
  app.use(passport.default.initialize());
}

// 路由（添加缓存中间件）
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files', cacheMiddleware(60000), filesRoutes); // 文件列表缓存 60 秒
app.use('/api/messages', cacheMiddleware(10000), messagesRoutes); // 消息缓存 10 秒
app.use('/api/user', userRoutes);
app.use('/api/conversations', cacheMiddleware(30000), conversationsRoutes); // 会话列表缓存 30 秒

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '太极文件传输系统运行中' });
});

// 初始化数据库并启动服务器
initDatabase()
  .then(() => {
    // 初始化 Socket.IO 并导出 io 实例
    const io = initSocket(httpServer);

    // 将 io 实例挂载到 app 上，供路由使用
    app.set('io', io);

    httpServer.listen(PORT, '0.0.0.0', () => {
      const workerId = cluster.worker ? cluster.worker.id : 'Master';
      const pid = process.pid;

      // 获取本机 IP
      const interfaces = os.networkInterfaces();
      let localIP = 'localhost';
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (!iface.internal && iface.family === 'IPv4') {
            localIP = iface.address;
            break;
          }
        }
      }

      console.log(`🎯 服务器启动成功 http://${localIP}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });