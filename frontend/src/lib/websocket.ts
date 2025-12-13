'use client';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';
type MessageHandler = (data: unknown) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set();
  private clientId: string;
  private currentToken: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private _connectionState: ConnectionState = 'disconnected';

  constructor() {
    this.clientId = `web_${Math.random().toString(36).substr(2, 9)}`;
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  private setConnectionState(state: ConnectionState) {
    this._connectionState = state;
    this.connectionStateHandlers.forEach((handler) => handler(state));
  }

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.currentToken = token;
    this.setConnectionState('connecting');

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const derivedWsBaseUrl = apiBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || derivedWsBaseUrl;
    this.ws = new WebSocket(`${wsUrl}/ws/${this.clientId}?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 过滤心跳响应和连接确认
        if (data.type === 'pong' || data.type === 'connected') {
          return;
        }
        this.messageHandlers.forEach((handler) => handler(data));
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.stopHeartbeat();
      this.setConnectionState('disconnected');
      this.tryReconnect(token);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30秒心跳
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private tryReconnect(token: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(token), this.reconnectDelay);
    } else {
      this.setConnectionState('failed');
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  reconnect() {
    this.disconnect();
    if (this.currentToken) {
      this.connect(this.currentToken);
    }
  }

  send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendText(content: string, deviceName: string = 'Web') {
    this.send({
      type: 'text',
      content,
      device_name: deviceName,
    });
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionStateChange(handler: ConnectionStateHandler) {
    this.connectionStateHandlers.add(handler);
    return () => this.connectionStateHandlers.delete(handler);
  }

  getClientId() {
    return this.clientId;
  }
}

export const wsClient = new WebSocketClient();
