/**
 * 响应缓存中间件
 * 缓存 GET 请求的响应，减少数据库查询和计算
 */

const cache = new Map();
const CACHE_DURATION = 30000; // 30秒缓存

export const cacheMiddleware = (duration = CACHE_DURATION) => {
  return (req, res, next) => {
    // 只缓存 GET 请求
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl || req.url}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < duration) {
      return res.json(cached.data);
    }

    // 劫持 res.json 方法
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // 缓存响应
      cache.set(key, {
        data,
        timestamp: Date.now()
      });

      // 设置过期清理
      setTimeout(() => {
        cache.delete(key);
      }, duration);

      return originalJson(data);
    };

    next();
  };
};

/**
 * 清除特定路径的缓存
 */
export const clearCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

/**
 * 清除所有缓存
 */
export const clearAllCache = () => {
  cache.clear();
};

/**
 * 获取缓存统计
 */
export const getCacheStats = () => {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
};