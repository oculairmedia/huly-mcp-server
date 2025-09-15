/**
 * WizardPerformance.js
 *
 * Performance optimization for wizard system including caching,
 * memory management, and session pooling.
 */

import { getLogger } from '../../utils/logger.js';
import { LRUCache } from '../../utils/cache.js';

const logger = getLogger('wizard-performance');

/**
 * Performance configuration
 */
const PERFORMANCE_CONFIG = {
  maxConcurrentSessions: 100,
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  cacheMaxSize: 50,
  cacheTTLMs: 10 * 60 * 1000, // 10 minutes
  maxStateSize: 1024 * 1024, // 1MB per session state
  enableCompression: true,
  enableMetrics: true,
};

/**
 * Performance metrics tracker
 */
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      sessionCreated: 0,
      sessionCompleted: 0,
      sessionAborted: 0,
      sessionTimeout: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageStepTime: [],
      memoryUsage: [],
      errors: 0,
    };
    this.startTime = Date.now();
  }

  recordSessionCreated() {
    this.metrics.sessionCreated++;
  }

  recordSessionCompleted() {
    this.metrics.sessionCompleted++;
  }

  recordSessionAborted() {
    this.metrics.sessionAborted++;
  }

  recordSessionTimeout() {
    this.metrics.sessionTimeout++;
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  recordStepTime(timeMs) {
    this.metrics.averageStepTime.push(timeMs);
    // Keep only last 100 measurements
    if (this.metrics.averageStepTime.length > 100) {
      this.metrics.averageStepTime.shift();
    }
  }

  recordMemoryUsage() {
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
      });
      // Keep only last 50 measurements
      if (this.metrics.memoryUsage.length > 50) {
        this.metrics.memoryUsage.shift();
      }
    }
  }

  recordError() {
    this.metrics.errors++;
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const avgStepTime =
      this.metrics.averageStepTime.length > 0
        ? this.metrics.averageStepTime.reduce((a, b) => a + b, 0) /
          this.metrics.averageStepTime.length
        : 0;

    const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] || {};

    return {
      uptime: Math.round(uptime / 1000), // seconds
      sessions: {
        created: this.metrics.sessionCreated,
        completed: this.metrics.sessionCompleted,
        aborted: this.metrics.sessionAborted,
        timedOut: this.metrics.sessionTimeout,
        completionRate:
          this.metrics.sessionCreated > 0
            ? `${((this.metrics.sessionCompleted / this.metrics.sessionCreated) * 100).toFixed(2)}%`
            : '0%',
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate:
          this.metrics.cacheHits + this.metrics.cacheMisses > 0
            ? `${(
                (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) *
                100
              ).toFixed(2)}%`
            : '0%',
      },
      performance: {
        averageStepTimeMs: Math.round(avgStepTime),
        memoryUsageMB: {
          heapUsed: Math.round((latestMemory.heapUsed || 0) / 1024 / 1024),
          heapTotal: Math.round((latestMemory.heapTotal || 0) / 1024 / 1024),
          rss: Math.round((latestMemory.rss || 0) / 1024 / 1024),
        },
      },
      errors: this.metrics.errors,
    };
  }

  reset() {
    this.metrics = {
      sessionCreated: 0,
      sessionCompleted: 0,
      sessionAborted: 0,
      sessionTimeout: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageStepTime: [],
      memoryUsage: [],
      errors: 0,
    };
    this.startTime = Date.now();
  }
}

/**
 * Session pool for reusing session objects
 */
class SessionPool {
  constructor(maxSize = 10) {
    this.pool = [];
    this.maxSize = maxSize;
  }

  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return null;
  }

  release(session) {
    if (this.pool.length < this.maxSize) {
      // Reset session for reuse
      session.reset();
      this.pool.push(session);
    }
  }

  clear() {
    this.pool = [];
  }

  getSize() {
    return this.pool.length;
  }
}

/**
 * Optimized wizard state manager with performance enhancements
 */
export class OptimizedWizardStateManager {
  constructor(baseManager) {
    this.baseManager = baseManager;
    this.cache = new LRUCache(PERFORMANCE_CONFIG.cacheMaxSize);
    this.sessionPool = new SessionPool(20);
    this.metrics = new PerformanceMetrics();
    this.cleanupTimer = null;
    this.compressionEnabled = PERFORMANCE_CONFIG.enableCompression;

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Create session with performance optimizations
   */
  createSession(wizardDefinition, initialState = {}) {
    const startTime = Date.now();

    try {
      // Check session limit
      if (this.baseManager.sessions.size >= PERFORMANCE_CONFIG.maxConcurrentSessions) {
        this.cleanupExpiredSessions();
        if (this.baseManager.sessions.size >= PERFORMANCE_CONFIG.maxConcurrentSessions) {
          throw new Error('Maximum concurrent sessions reached');
        }
      }

      // Try to get pooled session
      let session = this.sessionPool.acquire();
      if (session) {
        session.reinitialize(wizardDefinition, initialState);
      } else {
        session = this.baseManager.createSession(wizardDefinition, initialState);
      }

      // Cache session metadata
      this.cache.set(`session:${session.id}:meta`, {
        wizardName: wizardDefinition.name,
        startTime: session.metadata.startTime,
      });

      this.metrics.recordSessionCreated();
      this.metrics.recordStepTime(Date.now() - startTime);

      return session;
    } catch (error) {
      this.metrics.recordError();
      logger.error('Failed to create optimized session', { error });
      throw error;
    }
  }

  /**
   * Get session with caching
   */
  getSession(sessionId) {
    const cacheKey = `session:${sessionId}`;

    // Check cache first
    const cachedSession = this.cache.get(cacheKey);
    if (cachedSession) {
      this.metrics.recordCacheHit();
      return cachedSession;
    }

    // Get from base manager
    const session = this.baseManager.getSession(sessionId);
    if (session) {
      this.cache.set(cacheKey, session, PERFORMANCE_CONFIG.cacheTTLMs);
      this.metrics.recordCacheMiss();
    }

    return session;
  }

  /**
   * Remove session with cleanup
   */
  removeSession(sessionId) {
    const session = this.baseManager.getSession(sessionId);
    if (session) {
      // Return to pool if possible
      if (!session.isCompleted && !session.isAborted) {
        this.sessionPool.release(session);
      }

      // Clear from cache
      this.cache.delete(`session:${sessionId}`);
      this.cache.delete(`session:${sessionId}:meta`);

      // Remove from base manager
      this.baseManager.removeSession(sessionId);

      if (session.isCompleted) {
        this.metrics.recordSessionCompleted();
      } else if (session.isAborted) {
        this.metrics.recordSessionAborted();
      }
    }
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    this.baseManager.sessions.forEach((session, id) => {
      const lastActivity = new Date(session.metadata.lastActivity).getTime();
      if (now - lastActivity > PERFORMANCE_CONFIG.sessionTimeoutMs) {
        expiredSessions.push(id);
      }
    });

    expiredSessions.forEach((id) => {
      logger.info(`Removing expired session: ${id}`);
      this.removeSession(id);
      this.metrics.recordSessionTimeout();
    });

    // Record memory usage
    this.metrics.recordMemoryUsage();

    return expiredSessions.length;
  }

  /**
   * Start periodic cleanup
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      const cleaned = this.cleanupExpiredSessions();
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired sessions`);
      }

      // Clear stale cache entries
      this.cache.prune();

      // Log metrics periodically
      if (PERFORMANCE_CONFIG.enableMetrics) {
        const metrics = this.metrics.getMetrics();
        logger.debug('Performance metrics', metrics);
      }
    }, PERFORMANCE_CONFIG.cleanupIntervalMs);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Compress session state for storage
   */
  compressState(state) {
    if (!this.compressionEnabled) {
      return state;
    }

    try {
      const stateStr = JSON.stringify(state);
      if (stateStr.length > 1024) {
        // Simple compression using base64 encoding
        // In production, use proper compression like zlib
        return {
          compressed: true,
          data: Buffer.from(stateStr).toString('base64'),
        };
      }
      return state;
    } catch (error) {
      logger.error('Failed to compress state', { error });
      return state;
    }
  }

  /**
   * Decompress session state
   */
  decompressState(state) {
    if (!state.compressed) {
      return state;
    }

    try {
      const stateStr = Buffer.from(state.data, 'base64').toString();
      return JSON.parse(stateStr);
    } catch (error) {
      logger.error('Failed to decompress state', { error });
      return {};
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.metrics.getMetrics(),
      cache: {
        ...this.metrics.getMetrics().cache,
        size: this.cache.size,
        maxSize: this.cache.maxSize,
      },
      sessionPool: {
        available: this.sessionPool.getSize(),
        maxSize: this.sessionPool.maxSize,
      },
      activeSessions: this.baseManager.sessions.size,
      maxConcurrentSessions: PERFORMANCE_CONFIG.maxConcurrentSessions,
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics.reset();
  }

  /**
   * Optimize memory usage
   */
  optimizeMemory() {
    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }

    // Clear caches
    this.cache.clear();

    // Clear session pool
    this.sessionPool.clear();

    // Cleanup expired sessions
    this.cleanupExpiredSessions();

    logger.info('Memory optimization completed');
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    this.stopCleanupTimer();
    this.cache.clear();
    this.sessionPool.clear();
    logger.info('Optimized wizard state manager shutdown');
  }
}

/**
 * Create optimized state manager wrapper
 */
export function createOptimizedStateManager(baseManager) {
  return new OptimizedWizardStateManager(baseManager);
}

/**
 * Performance utilities
 */
export const PerformanceUtils = {
  /**
   * Measure execution time
   */
  measureTime: async (fn, label = 'Operation') => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      logger.debug(`${label} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`${label} failed after ${duration}ms`, { error });
      throw error;
    }
  },

  /**
   * Debounce function calls
   */
  debounce: (fn, delay = 300) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Throttle function calls
   */
  throttle: (fn, limit = 1000) => {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Batch operations
   */
  batch: (operations, batchSize = 10) => {
    const batches = [];
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    return batches;
  },
};

export default {
  OptimizedWizardStateManager,
  createOptimizedStateManager,
  PerformanceUtils,
  PerformanceMetrics,
  PERFORMANCE_CONFIG,
};
