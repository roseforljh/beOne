/**
 * IndexedDB 缓存管理器
 * 使用浏览器本地数据库缓存大量数据，比 localStorage 更强大
 */

class IndexedDBCache {
  constructor(dbName = 'BeOneCache', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  /**
   * 初始化数据库
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建对象存储
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('created_at', 'created_at', { unique: false });
          fileStore.createIndex('user_id', 'user_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('conversation_id', 'conversation_id', { unique: false });
          msgStore.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('expires_at', 'expires_at', { unique: false });
        }
      };
    });
  }

  /**
   * 获取数据
   */
  async get(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 设置数据
   */
  async set(storeName, data) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除数据
   */
  async delete(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取所有数据
   */
  async getAll(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空存储
   */
  async clear(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 缓存 API 响应（带过期时间）
   */
  async cacheResponse(key, data, ttl = 3600000) { // 默认 1 小时
    const cacheData = {
      key,
      data,
      expires_at: Date.now() + ttl,
      created_at: Date.now()
    };

    return this.set('cache', cacheData);
  }

  /**
   * 获取缓存的响应
   */
  async getCachedResponse(key) {
    const cached = await this.get('cache', key);
    
    if (!cached) return null;
    
    // 检查是否过期
    if (cached.expires_at < Date.now()) {
      await this.delete('cache', key);
      return null;
    }

    return cached.data;
  }

  /**
   * 清理过期缓存
   */
  async cleanExpiredCache() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expires_at');
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`[IndexedDB] 清理了 ${deletedCount} 个过期缓存`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取存储统计
   */
  async getStats() {
    if (!this.db) await this.init();

    const stats = {};
    const storeNames = ['files', 'messages', 'cache'];

    for (const storeName of storeNames) {
      const data = await this.getAll(storeName);
      stats[storeName] = {
        count: data.length,
        size: new Blob([JSON.stringify(data)]).size
      };
    }

    return stats;
  }
}

// 创建全局实例
export const dbCache = new IndexedDBCache();

// 自动初始化
dbCache.init().catch(err => {
  console.error('[IndexedDB] 初始化失败:', err);
});

// 定期清理过期缓存（每 10 分钟）
setInterval(() => {
  dbCache.cleanExpiredCache().catch(err => {
    console.error('[IndexedDB] 清理过期缓存失败:', err);
  });
}, 600000);

export default IndexedDBCache;