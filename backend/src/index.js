import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
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

// 优先加载开发环境配置
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.development' });
} else {
  dotenv.config();
}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// 性能优化中间件
// 1. 启用 gzip 压缩（提高压缩级别以充分利用 CPU）
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 9, // 最高压缩级别，充分利用 CPU
  threshold: 512 // 降低阈值，压缩更多内容
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

// 5. 请求日志（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.log(`[慢请求] ${req.method} ${req.path} - ${duration}ms`);
      }
    });
    next();
  });
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

      console.log(`
🎯 太极文件传输系统后端启动成功 [Worker ${workerId}, PID: ${pid}]`);
      console.log(`📡 服务器运行在: http://localhost:${PORT}`);
      console.log(`📱 局域网访问: http://${localIP}:${PORT}`);
      console.log(`💬 WebSocket 实时通信已启用`);
      console.log(`🔐 默认账号: root / 123456`);
      console.log(`👤 游客模式已启用`);
      console.log(`⚡ 响应缓存已启用`);
      console.log(`🚀 高性能模式已启用
`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });

