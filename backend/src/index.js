import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import { initSocket } from './config/socket.js';
// import { startCleanupScheduler } from './utils/guestCleanup.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import filesRoutes from './routes/files.js';
import messagesRoutes from './routes/messages.js';
import userRoutes from './routes/user.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/user', userRoutes);

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

