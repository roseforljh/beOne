import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  process.exit(1);
}

// 存储在线用户
const onlineUsers = new Map();

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*', // 支持环境变量配置
      methods: ['GET', 'POST'],
      credentials: true
    },
    // 性能优化配置
    pingTimeout: 60000, // 60秒
    pingInterval: 25000, // 25秒
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8, // 100MB
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    perMessageDeflate: {
      threshold: 1024 // 只压缩大于1KB的消息
    },
    httpCompression: {
      threshold: 1024
    },
    // 添加对代理的支持
    allowEIO3: true
  });

  // Socket 认证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('认证失败：未提供令牌'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.isGuest = decoded.is_guest || false;
      next();
    } catch (err) {
      next(new Error('认证失败：令牌无效'));
    }
  });

  // 连接处理
  io.on('connection', (socket) => {
    socket.sessionId = socket.id;

    // 记录在线用户
    onlineUsers.set(socket.id, {
      socketId: socket.id,
      username: socket.username,
      userId: socket.userId,
      connectedAt: new Date()
    });

    // 如果是 root 用户，发送所有在线用户列表
    if (socket.username === 'root') {
      socket.emit('online_users', Array.from(onlineUsers.values()));
      // 通知其他 root 用户更新在线列表
      socket.broadcast.emit('online_users_update', Array.from(onlineUsers.values()));
    } else {
      // 游客只看到自己
      socket.emit('online_users', [{
        socketId: socket.id,
        username: socket.username,
        connectedAt: new Date()
      }]);
    }

    // 加入用户房间（用于接收针对该用户的消息）
    socket.join(`user_${socket.userId}`);

    // 心跳响应
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // 发送文本消息
    socket.on('send_message', async (data) => {
      const { content, conversationId } = data;

      db.run(
        'INSERT INTO messages (user_id, type, content, session_id, conversation_id) VALUES (?, ?, ?, ?, ?)',
        [socket.userId, 'text', content, socket.sessionId, conversationId || null],
        function (err) {
          if (err) {
            socket.emit('error', { message: '消息发送失败' });
            return;
          }

          const message = {
            id: this.lastID,
            user_id: socket.userId,
            username: socket.username,
            type: 'text',
            content: content,
            session_id: socket.sessionId,
            conversation_id: conversationId || null,
            created_at: new Date().toISOString()
          };

          io.to(`user_${socket.userId}`).emit('new_message', message);

          if (conversationId) {
            db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId], function (err) {
              if (!err) {
                io.to(`user_${socket.userId}`).emit('conversation_updated', {
                  conversationId: conversationId,
                  updatedAt: new Date().toISOString()
                });
              }
            });
          }
        }
      );
    });

    // 发送文件消息
    socket.on('send_file_message', async (data) => {
      const { fileId, conversationId } = data;

      db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, socket.userId], (err, file) => {
        if (err || !file) {
          socket.emit('error', { message: '文件不存在或无权访问' });
          return;
        }

        db.run(
          'INSERT INTO messages (user_id, type, file_id, session_id, conversation_id) VALUES (?, ?, ?, ?, ?)',
          [socket.userId, 'file', fileId, socket.sessionId, conversationId || null],
          function (err) {
            if (err) {
              socket.emit('error', { message: '文件消息发送失败' });
              return;
            }

            const message = {
              id: this.lastID,
              user_id: socket.userId,
              username: socket.username,
              type: 'file',
              file: {
                id: file.id,
                filename: file.filename,
                original_name: file.original_name,
                mimetype: file.mimetype,
                size: file.size
              },
              session_id: socket.sessionId,
              conversation_id: conversationId || null,
              created_at: new Date().toISOString()
            };

            io.to(`user_${socket.userId}`).emit('new_message', message);

            if (conversationId) {
              db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId], function (err) {
                if (!err) {
                  io.to(`user_${socket.userId}`).emit('conversation_updated', {
                    conversationId: conversationId,
                    updatedAt: new Date().toISOString()
                  });
                }
              });
            }
          }
        );
      });
    });

    // 用户正在输入（不需要广播，因为只有自己）
    socket.on('typing', () => {
      // 不做任何事
    });

    // 用户停止输入（不需要广播，因为只有自己）
    socket.on('stop_typing', () => {
      // 不做任何事
    });

    // 撤回消息
    socket.on('recall_message', async (data) => {
      const { messageId } = data;

      db.get('SELECT * FROM messages WHERE id = ? AND user_id = ?', [messageId, socket.userId], (err, message) => {
        if (err) {
          socket.emit('error', { message: '查询消息失败' });
          return;
        }

        if (!message) {
          socket.emit('error', { message: '消息不存在或无权撤回' });
          return;
        }

        db.run('DELETE FROM messages WHERE id = ?', [messageId], function (err) {
          if (err) {
            socket.emit('error', { message: '撤回失败' });
            return;
          }

          io.to(`user_${socket.userId}`).emit('message_recalled', {
            messageId: messageId,
            userId: socket.userId
          });
        });
      });
    });

    // 批量消息处理（可选）
    socket.on('batch_messages', async (messages) => {
      if (!Array.isArray(messages) || messages.length === 0) return;

      // 批量处理消息
      for (const msg of messages) {
        if (msg.event === 'send_message') {
          socket.emit('send_message', msg.data);
        } else if (msg.event === 'send_file_message') {
          socket.emit('send_file_message', msg.data);
        }
      }
    });

    // 断开连接
    socket.on('disconnect', () => {
      onlineUsers.delete(socket.id);
      io.emit('online_users_update', Array.from(onlineUsers.values()));
    });

    // 错误处理
    socket.on('error', () => {});
  });

  return io;
};

