/**
 * cache.js
 *
 * Simple LRU (Least Recently Used) cache implementation
 * for performance optimization.
 */

export class LRUCache {
  constructor(maxSize = 100, defaultTTL = 600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL; // 10 minutes default
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      return undefined;
    }

    // Check if expired
    if (item.expiry && Date.now() > item.expiry) {
      this.delete(key);
      return undefined;
    }

    // Update access order
    this.updateAccessOrder(key);

    return item.value;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.defaultTTL) {
    // Remove if exists to update position
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Evict LRU item if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add to cache
    this.cache.set(key, {
      value,
      expiry: ttl ? Date.now() + ttl : null
    });

    // Add to access order
    this.accessOrder.push(key);
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    if (this.cache.delete(key)) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return true;
    }
    return false;
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {boolean} True if exists and not expired
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    if (item.expiry && Date.now() > item.expiry) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached items
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   * @returns {number} Number of cached items
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Prune expired items
   * @returns {number} Number of items removed
   */
  prune() {
    const now = Date.now();
    let pruned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && now > item.expiry) {
        this.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;

    for (const item of this.cache.values()) {
      if (item.expiry && now > item.expiry) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize * 100).toFixed(2) + '%',
      expired,
      active: this.cache.size - expired
    };
  }

  /**
   * Update access order for LRU tracking
   * @private
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used item
   * @private
   */
  evictLRU() {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      this.delete(lruKey);
    }
  }

  /**
   * Get all keys
   * @returns {Array} Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   * @returns {Array} Array of cached values
   */
  values() {
    const values = [];
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (!item.expiry || now <= item.expiry) {
        values.push(item.value);
      }
    }

    return values;
  }
}

/**
 * Create a memoized version of a function
 * @param {Function} fn - Function to memoize
 * @param {Object} options - Memoization options
 * @returns {Function} Memoized function
 */
export function memoize(fn, options = {}) {
  const {
    maxSize = 100,
    ttl = 600000,
    keyGenerator = (...args) => JSON.stringify(args)
  } = options;

  const cache = new LRUCache(maxSize, ttl);

  return async function memoizedFn(...args) {
    const key = keyGenerator(...args);

    // Check cache
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute function
    const result = await fn.apply(this, args);

    // Cache result
    cache.set(key, result, ttl);

    return result;
  };
}

/**
 * Cache manager for managing multiple caches
 */
export class CacheManager {
  constructor() {
    this.caches = new Map();
  }

  /**
   * Create or get a named cache
   * @param {string} name - Cache name
   * @param {number} maxSize - Maximum cache size
   * @param {number} defaultTTL - Default TTL
   * @returns {LRUCache} Cache instance
   */
  getCache(name, maxSize = 100, defaultTTL = 600000) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new LRUCache(maxSize, defaultTTL));
    }
    return this.caches.get(name);
  }

  /**
   * Delete a named cache
   * @param {string} name - Cache name
   * @returns {boolean} True if deleted
   */
  deleteCache(name) {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      return this.caches.delete(name);
    }
    return false;
  }

  /**
   * Clear all caches
   */
  clearAll() {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Prune all caches
   * @returns {number} Total items pruned
   */
  pruneAll() {
    let totalPruned = 0;
    for (const cache of this.caches.values()) {
      totalPruned += cache.prune();
    }
    return totalPruned;
  }

  /**
   * Get statistics for all caches
   * @returns {Object} Statistics for all caches
   */
  getAllStats() {
    const stats = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}

// Export singleton cache manager
export const cacheManager = new CacheManager();

export default {
  LRUCache,
  CacheManager,
  cacheManager,
  memoize
};