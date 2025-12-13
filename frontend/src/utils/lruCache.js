/**
 * LRU (Least Recently Used) 缓存算法
 * 高效的缓存淘汰策略，保留最近使用的数据
 */

class LRUCache {
  constructor(capacity = 100) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * 获取缓存值
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    // 将访问的项移到最后（最近使用）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  /**
   * 设置缓存值
   */
  set(key, value) {
    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果超过容量，删除最旧的（第一个）
    if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // 添加到最后
    this.cache.set(key, value);
  }

  /**
   * 删除缓存
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size() {
    return this.cache.size;
  }

  /**
   * 检查是否存在
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * 获取所有键
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存统计
   */
  stats() {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      usage: ((this.cache.size / this.capacity) * 100).toFixed(2) + '%'
    };
  }
}

// 创建全局 LRU 缓存实例
export const apiCache = new LRUCache(200);        // API 响应缓存
export const imageCache = new LRUCache(100);      // 图片缓存
export const fileMetaCache = new LRUCache(500);   // 文件元数据缓存

// 导出类供其他地方使用
export default LRUCache;