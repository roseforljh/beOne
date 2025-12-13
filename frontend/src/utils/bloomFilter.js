/**
 * 布隆过滤器（Bloom Filter）
 * 用于快速判断元素是否可能存在，节省数据库查询
 * 特点：空间效率高，但有一定误判率（false positive）
 */

class BloomFilter {
  constructor(size = 10000, hashCount = 3) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  /**
   * 简单的哈希函数
   */
  hash(str, seed = 0) {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % this.size;
  }

  /**
   * 添加元素
   */
  add(item) {
    const str = String(item);
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(str, i);
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      this.bits[byteIndex] |= (1 << bitIndex);
    }
  }

  /**
   * 检查元素是否可能存在
   * 返回 true：可能存在（需要进一步查询）
   * 返回 false：一定不存在（可以跳过查询）
   */
  mightContain(item) {
    const str = String(item);
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(str, i);
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
        return false; // 一定不存在
      }
    }
    return true; // 可能存在
  }

  /**
   * 清空过滤器
   */
  clear() {
    this.bits = new Uint8Array(Math.ceil(this.size / 8));
  }

  /**
   * 获取统计信息
   */
  stats() {
    let setBits = 0;
    for (let i = 0; i < this.bits.length; i++) {
      for (let j = 0; j < 8; j++) {
        if (this.bits[i] & (1 << j)) {
          setBits++;
        }
      }
    }
    return {
      size: this.size,
      hashCount: this.hashCount,
      setBits,
      fillRate: ((setBits / this.size) * 100).toFixed(2) + '%'
    };
  }

  /**
   * 序列化（用于存储）
   */
  serialize() {
    return {
      size: this.size,
      hashCount: this.hashCount,
      bits: Array.from(this.bits)
    };
  }

  /**
   * 反序列化（从存储恢复）
   */
  static deserialize(data) {
    const filter = new BloomFilter(data.size, data.hashCount);
    filter.bits = new Uint8Array(data.bits);
    return filter;
  }
}

// 创建全局布隆过滤器实例
export const fileExistsFilter = new BloomFilter(50000, 4); // 文件存在性检查
export const userSeenFilter = new BloomFilter(10000, 3);   // 用户已查看标记

// 导出类
export default BloomFilter;