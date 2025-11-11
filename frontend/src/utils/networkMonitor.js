import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

/**
 * 网络状态监控器
 * 根据网络状态自动调整应用行为
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
    if (!Capacitor.isNativePlatform() || this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('[NetworkMonitor] 开始监控网络状态');

    try {
      // 获取当前网络状态
      const status = await Network.getStatus();
      this.handleStatusChange(status);

      // 监听网络状态变化
      Network.addListener('networkStatusChange', (status) => {
        this.handleStatusChange(status);
      });
    } catch (error) {
      console.error('[NetworkMonitor] 启动失败:', error);
    }
  }

  /**
   * 停止监控
   */
  stop() {
    if (!this.isMonitoring) return;

    Network.removeAllListeners();
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
    } else if (status.connectionType === 'wifi') {
      this.networkQuality = 'high';
    } else if (status.connectionType === 'cellular') {
      // 移动网络，质量中等
      this.networkQuality = 'medium';
    } else if (status.connectionType === '2g') {
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
    if (status.connectionType === 'wifi') {
      // WiFi: 使用高质量资源
      window.imageQuality = 'high';
      window.videoQuality = 'high';
      console.log('[NetworkMonitor] WiFi 连接，使用高质量资源');
    } else if (status.connectionType === 'cellular') {
      // 移动网络: 使用中等质量资源
      window.imageQuality = 'medium';
      window.videoQuality = 'medium';
      console.log('[NetworkMonitor] 移动网络，使用中等质量资源');
    } else if (status.connectionType === '2g') {
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
    return this.currentStatus?.connectionType === 'cellular';
  }
}

// 导出单例
export const networkMonitor = new NetworkMonitor();

// 自动启动监控（仅在移动端）
if (Capacitor.isNativePlatform()) {
  networkMonitor.start();
}