import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import { initDatabase } from './config/database.js';
import { initSocket } from './config/socket.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import filesRoutes from './routes/files.js';
import messagesRoutes from './routes/messages.js';
import userRoutes from './routes/user.js';
import conversationsRoutes from './routes/conversations.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// 性能优化中间件
// 1. 启用 gzip 压缩
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // 压缩级别 (0-9)
  threshold: 1024 // 只压缩大于1KB的响应
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

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/conversations', conversationsRoutes);

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
      console.log(`\n🎯 太极文件传输系统后端启动成功`);
      console.log(`📡 服务器运行在: http://localhost:${PORT}`);
      console.log(`📱 局域网访问: http://192.168.0.101:${PORT}`);
      console.log(`💬 WebSocket 实时通信已启用`);
      console.log(`🔐 默认账号: root / 123456`);
      console.log(`👤 游客模式已启用\n`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });

