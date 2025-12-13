import { Capacitor } from '@capacitor/core';

/**
 * 请求队列管理器
 * 用于控制并发请求数量，避免网络拥塞
 */
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    // 移动端降低并发数
    this.maxConcurrent = Capacitor.isNativePlatform() ? 3 : 6;
    this.activeRequests = 0;
  }

  /**
   * 添加请求到队列
   * @param {Function} requestFn - 返回 Promise 的请求函数
   * @param {number} priority - 优先级（数字越小优先级越高）
   * @returns {Promise} 请求结果
   */
  async add(requestFn, priority = 5) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject, priority });
      // 按优先级排序
      this.queue.sort((a, b) => a.priority - b.priority);
      this.process();
    });
  }

  /**
   * 处理队列中的请求
   */
  async process() {
    if (this.processing || this.queue.length === 0) return;
    if (this.activeRequests >= this.maxConcurrent) return;

    this.processing = true;
    const { requestFn, resolve, reject } = this.queue.shift();
    this.activeRequests++;

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;
      this.processing = false;
      // 继续处理队列
      if (this.queue.length > 0) {
        this.process();
      }
    }
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue.forEach(({ reject }) => {
      reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// 导出单例
export const requestQueue = new RequestQueue();