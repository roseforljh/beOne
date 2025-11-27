import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { API_CONFIG } from '../config/api.config';

let socket = null;
let heartbeatInterval = null;
let messageQueue = [];
let batchTimeout = null;

// 心跳配置
const HEARTBEAT_INTERVAL = 30000; // 30秒
const BATCH_DELAY = 100; // 100ms批处理延迟

export const connectSocket = (token) => {
  if (socket?.connected) {
    return socket;
  }

  // 动态获取 Socket URL
  const getSocketUrl = () => {
    if (Capacitor.isNativePlatform()) {
      // 在原生 App 中，从 localStorage 读取用户配置的 API 地址
      const savedApiUrl = localStorage.getItem('apiUrl');
      return savedApiUrl || API_CONFIG.API_URL;
    }
    // 在 Web 环境中
    const isDevelopment = window.location.port === '5173' ||
                          window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';
    
    if (isDevelopment) {
      // 开发环境连接到本地5000端口
      return `http://${window.location.hostname}:5000`;
    } else {
      // 生产环境：使用与当前页面相同的协议（http/https）
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const hostname = window.location.hostname;
      const port = window.location.protocol === 'https:' ? '' : ':5000';
      return `${protocol}//${hostname}${port}`;
    }
  };

  const socketUrl = getSocketUrl();
  const isSecureEnvironment = window.location.protocol === 'https:';
  const formattedToken = token && token.startsWith('Bearer ') ? token.substring(7) : token;
  
  socket = io(socketUrl, {
    auth: { token: formattedToken },
    // 移动端优化：优先使用 WebSocket
    transports: Capacitor.isNativePlatform() ? ['websocket'] : ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    reconnectionAttempts: 5,
    timeout: 20000,
    upgrade: true,
    rememberUpgrade: true,
    perMessageDeflate: {
      threshold: 1024
    },
    forceNew: false,
    multiplex: true,
    enablesXDR: false,
    pingInterval: 25000,
    pingTimeout: 60000,
    secure: isSecureEnvironment,
    rejectUnauthorized: false,
    extraHeaders: isSecureEnvironment ? {
      'Authorization': `Bearer ${formattedToken}`
    } : {}
  });

  socket.on('connect', () => {
    startHeartbeat();
  });

  socket.on('disconnect', () => {
    stopHeartbeat();
  });

  return socket;
};

// 心跳机制
const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (socket?.connected) {
      socket.emit('ping');
    }
  }, HEARTBEAT_INTERVAL);
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    stopHeartbeat();
    clearBatchTimeout();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

// 批处理消息发送
const processBatchMessages = () => {
  if (messageQueue.length === 0) return;
  
  const messages = [...messageQueue];
  messageQueue = [];
  
  if (socket?.connected) {
    // 如果有多条消息，批量发送
    if (messages.length > 1) {
      socket.emit('batch_messages', messages);
    } else {
      // 单条消息直接发送
      const msg = messages[0];
      socket.emit(msg.event, msg.data);
    }
  }
};

const clearBatchTimeout = () => {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }
};

const queueMessage = (event, data) => {
  messageQueue.push({ event, data });
  
  clearBatchTimeout();
  batchTimeout = setTimeout(processBatchMessages, BATCH_DELAY);
};

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

// 优化：防抖输入状态
let typingTimeout = null;
export const emitTyping = () => {
  if (socket?.connected) {
    if (typingTimeout) return; // 防止频繁发送
    socket.emit('typing');
    typingTimeout = setTimeout(() => {
      typingTimeout = null;
    }, 1000);
  }
};

export const emitStopTyping = () => {
  if (socket?.connected) {
    socket.emit('stop_typing');
  }
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
};

export const recallMessage = (messageId) => {
  if (socket?.connected) {
    socket.emit('recall_message', { messageId });
  }
};

