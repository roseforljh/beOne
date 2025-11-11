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
    // 在 Web 开发环境中
    const isDevelopment = window.location.port === '5173' ||
                          window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';
    
    return isDevelopment
      ? `http://${window.location.hostname}:5000`
      : window.location.origin;
  };

  const socketUrl = getSocketUrl();

  console.log('Socket连接地址:', socketUrl);

  socket = io(socketUrl, {
    auth: { token },
    // 移动端优化：优先使用 WebSocket，减少 polling 延迟
    transports: Capacitor.isNativePlatform() ? ['websocket'] : ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500, // 减少重连延迟（移动端优化）
    reconnectionDelayMax: 3000, // 减少最大重连延迟
    reconnectionAttempts: 5, // 减少重连次数，快速失败
    timeout: 8000, // 减少超时时间（移动端优化）
    // 性能优化配置
    upgrade: true,
    rememberUpgrade: true,
    perMessageDeflate: {
      threshold: 1024 // 只压缩大于1KB的消息
    },
    // 移动端网络优化
    forceNew: false,
    multiplex: true,
    // 启用二进制传输优化
    enablesXDR: false,
    // 心跳配置
    pingInterval: 25000,
    pingTimeout: 5000
  });

  socket.on('connect', () => {
    console.log('Socket 连接成功');
    startHeartbeat();
  });

  socket.on('connect_error', (error) => {
    console.error('Socket 连接错误:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket 断开连接:', reason);
    stopHeartbeat();
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket 重连成功，尝试次数:', attemptNumber);
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('Socket 尝试重连:', attemptNumber);
  });

  socket.on('reconnect_error', (error) => {
    console.error('Socket 重连错误:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('Socket 重连失败');
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
    console.log('发送撤回请求，消息ID:', messageId);
    socket.emit('recall_message', { messageId });
  } else {
    console.error('Socket 未连接，无法撤回消息');
  }
};

