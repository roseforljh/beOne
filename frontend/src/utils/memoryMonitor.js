import { Capacitor } from '@capacitor/core';
import { api } from './api';

/**
 * 内存监控工具
 * 监控应用内存使用情况，自动清理缓存
 */
class MemoryMonitor {
  constructor() {
    this.isMonitoring = false;
    this.checkInterval = 30000; // 30秒检查一次
    this.highMemoryThreshold = 0.8; // 80% 内存使用率
    this.criticalMemoryThreshold = 0.9; // 90% 内存使用率
    this.intervalId = null;
  }

  /**
   * 开始监控
   */
  start() {
    if (!Capacitor.isNativePlatform() || this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('[MemoryMonitor] 开始监控内存使用');

    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);

    // 立即执行一次检查
    this.checkMemory();
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('[MemoryMonitor] 停止监控内存使用');
  }

  /**
   * 检查内存使用情况
   */
  checkMemory() {
    if (!performance.memory) {
      console.warn('[MemoryMonitor] performance.memory 不可用');
      return;
    }

    const used = performance.memory.usedJSHeapSize;
    const total = performance.memory.totalJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;
    const usageRatio = used / total;

    const usedMB = (used / 1048576).toFixed(2);
    const totalMB = (total / 1048576).toFixed(2);
    const limitMB = (limit / 1048576).toFixed(2);

    console.log(
      `[MemoryMonitor] 内存使用: ${usedMB}MB / ${totalMB}MB (限制: ${limitMB}MB) - ${(usageRatio * 100).toFixed(1)}%`
    );

    // 根据内存使用情况采取行动
    if (usageRatio >= this.criticalMemoryThreshold) {
      console.warn('[MemoryMonitor] 内存使用率过高，执行紧急清理');
      this.emergencyCleanup();
    } else if (usageRatio >= this.highMemoryThreshold) {
      console.warn('[MemoryMonitor] 内存使用率较高，执行常规清理');
      this.regularCleanup();
    }
  }

  /**
   * 常规清理
   */
  regularCleanup() {
    console.log('[MemoryMonitor] 执行常规清理...');
    
    // 清理 API 缓存
    if (api && api.clearCache) {
      api.clearCache();
      console.log('[MemoryMonitor] API 缓存已清理');
    }

    // 触发垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
      console.log('[MemoryMonitor] 垃圾回收已触发');
    }
  }

  /**
   * 紧急清理
   */
  emergencyCleanup() {
    console.warn('[MemoryMonitor] 执行紧急清理...');
    
    // 清理所有缓存
    this.regularCleanup();

    // 清理 localStorage 中的临时数据
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('temp_') || key.startsWith('cache_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`[MemoryMonitor] 清理了 ${keysToRemove.length} 个临时 localStorage 项`);
    } catch (error) {
      console.error('[MemoryMonitor] 清理 localStorage 失败:', error);
    }

    // 发出警告通知
    if (window.showToast) {
      window.showToast('内存使用率过高，已自动清理缓存', 'warning');
    }
  }

  /**
   * 获取当前内存状态
   */
  getMemoryStatus() {
    if (!performance.memory) {
      return null;
    }

    const used = performance.memory.usedJSHeapSize;
    const total = performance.memory.totalJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;

    return {
      used: (used / 1048576).toFixed(2) + ' MB',
      total: (total / 1048576).toFixed(2) + ' MB',
      limit: (limit / 1048576).toFixed(2) + ' MB',
      usagePercent: ((used / total) * 100).toFixed(1) + '%'
    };
  }
}

// 导出单例
export const memoryMonitor = new MemoryMonitor();

// 自动启动监控（仅在移动端）
if (Capacitor.isNativePlatform()) {
  // 延迟启动，避免影响应用启动性能
  setTimeout(() => {
    memoryMonitor.start();
  }, 5000);
}