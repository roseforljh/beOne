import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './database.js';
// import { registerGuestSession, unregisterGuestSession, updateGuestActivity } from '../utils/guestCleanup.js';

const JWT_SECRET = process.env.JWT_SECRET || 'taiji_secret_key_change_in_production';

// 存储在线用户
const onlineUsers = new Map();

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // 在生产环境中应该设置为具体的域名
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
    // 使用 socket.id 作为会话标识
    socket.sessionId = socket.id;
    console.log(`用户连接: ${socket.username} (${socket.userId}) [会话: ${socket.sessionId}]${socket.isGuest ? ' [游客]' : ''}`);
    
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
      
      try {
        // 保存到数据库，包含 session_id 和 conversation_id
        db.run(
          'INSERT INTO messages (user_id, type, content, session_id, conversation_id) VALUES (?, ?, ?, ?, ?)',
          [socket.userId, 'text', content, socket.sessionId, conversationId || null],
          function(err) {
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

            // 广播给该用户的所有会话（手机和电脑）
            io.to(`user_${socket.userId}`).emit('new_message', message);
            
            // 如果有会话ID，更新会话的更新时间并广播更新事件
            if (conversationId) {
              db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId], function(err) {
                if (!err) {
                  // 广播会话更新事件，通知所有客户端刷新会话列表
                  io.to(`user_${socket.userId}`).emit('conversation_updated', {
                    conversationId: conversationId,
                    updatedAt: new Date().toISOString()
                  });
                }
              });
            }
          }
        );
      } catch (error) {
        console.error('发送消息失败:', error);
        socket.emit('error', { message: '消息发送失败' });
      }
    });

    // 发送文件消息
    socket.on('send_file_message', async (data) => {
      const { fileId, conversationId } = data;
      
      try {
        // 验证文件存在
        db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, socket.userId], (err, file) => {
          if (err || !file) {
            socket.emit('error', { message: '文件不存在或无权访问' });
            return;
          }

          // 保存到数据库，包含 session_id 和 conversation_id
          db.run(
            'INSERT INTO messages (user_id, type, file_id, session_id, conversation_id) VALUES (?, ?, ?, ?, ?)',
            [socket.userId, 'file', fileId, socket.sessionId, conversationId || null],
            function(err) {
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

              // 广播给该用户的所有会话（手机和电脑）
              io.to(`user_${socket.userId}`).emit('new_message', message);
              
              // 如果有会话ID，更新会话的更新时间并广播更新事件
              if (conversationId) {
                db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId], function(err) {
                  if (!err) {
                    // 广播会话更新事件，通知所有客户端刷新会话列表
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
      } catch (error) {
        console.error('发送文件消息失败:', error);
        socket.emit('error', { message: '文件消息发送失败' });
      }
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
      
      console.log('=== 撤回消息请求 ===');
      console.log('消息ID:', messageId);
      console.log('用户ID:', socket.userId);
      
      try {
        // 验证消息所有权
        db.get('SELECT * FROM messages WHERE id = ? AND user_id = ?', [messageId, socket.userId], (err, message) => {
          if (err) {
            console.error('查询消息失败:', err);
            socket.emit('error', { message: '查询消息失败' });
            return;
          }

          if (!message) {
            console.error('消息不存在或无权撤回，messageId:', messageId, 'userId:', socket.userId);
            socket.emit('error', { message: '消息不存在或无权撤回' });
            return;
          }

          console.log('找到消息，准备删除:', message);

          // 删除消息
          db.run('DELETE FROM messages WHERE id = ?', [messageId], function(err) {
            if (err) {
              console.error('删除消息失败:', err);
              socket.emit('error', { message: '撤回失败' });
              return;
            }

            console.log('消息已从数据库删除，受影响的行数:', this.changes);

            // 通知该用户的所有会话（手机和电脑）
            const roomName = `user_${socket.userId}`;
            console.log('广播撤回事件到房间:', roomName, '消息ID:', messageId);
            io.to(roomName).emit('message_recalled', {
              messageId: messageId,
              userId: socket.userId
            });

            console.log('已广播撤回事件到所有会话');
          });
        });
      } catch (error) {
        console.error('撤回消息失败:', error);
        socket.emit('error', { message: '撤回失败' });
      }
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
    socket.on('disconnect', (reason) => {
      console.log(`用户断开: ${socket.username} (${socket.userId})${socket.isGuest ? ' [游客]' : ''} - 原因: ${reason}`);
      
      // 从在线用户列表中移除
      onlineUsers.delete(socket.id);
      
      // 通知所有 root 用户更新在线列表
      io.emit('online_users_update', Array.from(onlineUsers.values()));
    });
    
    // 错误处理
    socket.on('error', (error) => {
      console.error(`Socket错误 [${socket.username}]:`, error);
    });
  });

  return io;
};

