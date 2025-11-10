import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
  if (socket?.connected) {
    return socket;
  }

  // 判断是否为开发环境（端口5173表示Vite开发服务器）
  const isDevelopment = window.location.port === '5173' ||
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';
  
  // 开发环境：直连5000端口
  // 生产环境：使用当前域名（nginx代理）
  const socketUrl = isDevelopment
    ? `http://${window.location.hostname}:5000`
    : window.location.origin;

  console.log('Socket连接地址:', socketUrl);

  socket = io(socketUrl, {
    auth: {
      token
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('Socket 连接成功');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket 连接错误:', error.message);
  });

  socket.on('disconnect', () => {
    console.log('Socket 断开连接');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const sendTextMessage = (content, conversationId = null) => {
  if (socket?.connected) {
    socket.emit('send_message', { content, conversationId });
  }
};

export const sendFileMessage = (fileId, conversationId = null) => {
  if (socket?.connected) {
    socket.emit('send_file_message', { fileId, conversationId });
  }
};

export const emitTyping = () => {
  if (socket?.connected) {
    socket.emit('typing');
  }
};

export const emitStopTyping = () => {
  if (socket?.connected) {
    socket.emit('stop_typing');
  }
};

export const recallMessage = (messageId) => {
  if (socket?.connected) {
    console.log('发送撤回请求，消息ID:', messageId);
    socket.emit('recall_message', { messageId });
  } else {
    console.error('Socket 未连接，无法撤回消息');
  }
};

