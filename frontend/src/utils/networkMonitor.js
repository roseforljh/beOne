import { Capacitor } from '@capacitor/core';

/**
 * 网络状态监控器
 * 使用浏览器原生 API，无需额外依赖
 */
class NetworkMonitor {
  constructor() {
    this.isMonitoring = false;
    this.currentStatus = null;
    this.listeners = [];
    this.networkQuality = 'high'; // high, medium, low, offline
  }

  /**
   * 开始监控网络状态
   */
  async start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('[NetworkMonitor] 开始监控网络状态');

    try {
      // 使用浏览器原生 Network Information API
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      // 获取当前网络状态
      const status = {
        connected: navigator.onLine,
        connectionType: connection?.effectiveType || (navigator.onLine ? 'wifi' : 'none')
      };
      this.handleStatusChange(status);

      // 监听在线/离线事件
      window.addEventListener('online', this.handleOnlineEvent.bind(this));
      window.addEventListener('offline', this.handleOfflineEvent.bind(this));

      // 监听连接类型变化（如果支持）
      if (connection) {
        connection.addEventListener('change', this.handleConnectionChange.bind(this));
      }
    } catch (error) {
      console.error('[NetworkMonitor] 启动失败:', error);
    }
  }

  /**
   * 处理在线事件
   */
  handleOnlineEvent() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const status = {
      connected: true,
      connectionType: connection?.effectiveType || 'wifi'
    };
    this.handleStatusChange(status);
  }

  /**
   * 处理离线事件
   */
  handleOfflineEvent() {
    const status = {
      connected: false,
      connectionType: 'none'
    };
    this.handleStatusChange(status);
  }

  /**
   * 处理连接类型变化
   */
  handleConnectionChange() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const status = {
      connected: navigator.onLine,
      connectionType: connection?.effectiveType || 'unknown'
    };
    this.handleStatusChange(status);
  }

  /**
   * 停止监控
   */
  stop() {
    if (!this.isMonitoring) return;

    window.removeEventListener('online', this.handleOnlineEvent);
    window.removeEventListener('offline', this.handleOfflineEvent);
    
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.removeEventListener('change', this.handleConnectionChange);
    }

    this.isMonitoring = false;
    console.log('[NetworkMonitor] 停止监控网络状态');
  }

  /**
   * 处理网络状态变化
   */
  handleStatusChange(status) {
    console.log('[NetworkMonitor] 网络状态变化:', status);
    
    const previousStatus = this.currentStatus;
    this.currentStatus = status;

    // 判断网络质量
    this.updateNetworkQuality(status);

    // 通知所有监听器
    this.notifyListeners(status, previousStatus);

    // 根据网络状态调整应用行为
    this.adjustAppBehavior(status);
  }

  /**
   * 更新网络质量评估
   */
  updateNetworkQuality(status) {
    if (!status.connected) {
      this.networkQuality = 'offline';
    } else if (status.connectionType === 'wifi' || status.connectionType === '4g') {
      this.networkQuality = 'high';
    } else if (status.connectionType === '3g' || status.connectionType === 'cellular') {
      this.networkQuality = 'medium';
    } else if (status.connectionType === '2g' || status.connectionType === 'slow-2g') {
      this.networkQuality = 'low';
    } else {
      this.networkQuality = 'medium';
    }

    console.log(`[NetworkMonitor] 网络质量: ${this.networkQuality}`);
  }

  /**
   * 根据网络状态调整应用行为
   */
  adjustAppBehavior(status) {
    if (!status.connected) {
      console.warn('[NetworkMonitor] 网络已断开');
      this.handleOffline();
    } else {
      console.log('[NetworkMonitor] 网络已连接');
      this.handleOnline(status);
    }
  }

  /**
   * 处理离线状态
   */
  handleOffline() {
    // 设置全局离线标志
    window.isOffline = true;
    
    // 显示离线提示
    if (window.showToast) {
      window.showToast('网络已断开，部分功能不可用', 'error');
    }

    // 停止自动刷新
    if (window.stopAutoRefresh) {
      window.stopAutoRefresh();
    }
  }

  /**
   * 处理在线状态
   */
  handleOnline(status) {
    // 清除离线标志
    window.isOffline = false;

    // 根据网络类型调整策略
    if (status.connectionType === 'wifi' || status.connectionType === '4g') {
      // WiFi/4G: 使用高质量资源
      window.imageQuality = 'high';
      window.videoQuality = 'high';
      console.log('[NetworkMonitor] 高速网络，使用高质量资源');
    } else if (status.connectionType === '3g' || status.connectionType === 'cellular') {
      // 3G/移动网络: 使用中等质量资源
      window.imageQuality = 'medium';
      window.videoQuality = 'medium';
      console.log('[NetworkMonitor] 移动网络，使用中等质量资源');
    } else if (status.connectionType === '2g' || status.connectionType === 'slow-2g') {
      // 2G 网络: 使用低质量资源
      window.imageQuality = 'low';
      window.videoQuality = 'low';
      console.log('[NetworkMonitor] 2G 网络，使用低质量资源');
    }

    // 显示在线提示
    if (window.showToast) {
      window.showToast('网络已连接', 'success');
    }

    // 恢复自动刷新
    if (window.startAutoRefresh) {
      window.startAutoRefresh();
    }
  }

  /**
   * 添加状态变化监听器
   */
  addListener(callback) {
    this.listeners.push(callback);
    
    // 如果已有当前状态，立即调用回调
    if (this.currentStatus) {
      callback(this.currentStatus, null);
    }
  }

  /**
   * 移除监听器
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners(newStatus, oldStatus) {
    this.listeners.forEach(callback => {
      try {
        callback(newStatus, oldStatus);
      } catch (error) {
        console.error('[NetworkMonitor] 监听器执行失败:', error);
      }
    });
  }

  /**
   * 获取当前网络状态
   */
  getStatus() {
    return this.currentStatus;
  }

  /**
   * 获取网络质量
   */
  getQuality() {
    return this.networkQuality;
  }

  /**
   * 是否在线
   */
  isOnline() {
    return this.currentStatus?.connected || false;
  }

  /**
   * 是否是 WiFi
   */
  isWiFi() {
    return this.currentStatus?.connectionType === 'wifi';
  }

  /**
   * 是否是移动网络
   */
  isCellular() {
    const type = this.currentStatus?.connectionType;
    return type === 'cellular' || type === '2g' || type === '3g' || type === '4g';
  }
}

// 导出单例
export const networkMonitor = new NetworkMonitor();

// 自动启动监控
if (typeof window !== 'undefined') {
  networkMonitor.start();
}