/**
 * HulyClient - Wrapper for Huly platform connection management
 *
 * Provides connection pooling, retry logic, and proper cleanup
 * for the Huly API client
 */

import apiClient from '@hcengineering/api-client';
import WebSocket from 'ws';
import { HulyError } from './HulyError.js';

const { connect } = apiClient;

/**
 * Configuration for connection retries
 */
const RETRY_CONFIG = {
  maxAttempts: parseInt(process.env.HULY_CONNECTION_MAX_ATTEMPTS || '1', 10),
  initialDelay: 500,
  maxDelay: 3000,
  backoffFactor: 2,
  connectionTimeout: parseInt(process.env.HULY_CONNECTION_TIMEOUT_MS || '15000', 10),
};

/**
 * Configuration for concurrency control
 */
const CONCURRENCY_CONFIG = {
  maxConcurrent: 5, // Max concurrent requests
  queueTimeout: 60000, // 60 second queue timeout
};

/**
 * HulyClient class for managing connections to the Huly platform
 */
export class HulyClient {
  /**
   * Create a HulyClient instance
   * @param {Object} config - Configuration object
   * @param {string} config.url - Huly server URL
   * @param {string} config.email - User email for authentication
   * @param {string} config.password - User password for authentication
   * @param {string} config.workspace - Workspace to connect to
   */
  constructor(config) {
    this.config = config;
    this.transactorUrl = config.transactorUrl || process.env.HULY_TRANSACTOR_URL || null;
    this.client = null;
    this.connectionPromise = null;
    this.isConnecting = false;
    this.retryCount = 0;
    this.lastConnectionError = null;

    this.activeRequests = 0;
    this.requestQueue = [];
  }

  /**
   * Connect to Huly platform with retry logic
   * @returns {Promise<Object>} Connected client instance
   */
  async connect() {
    // If already connected, return existing client
    if (this.client && this.isConnected()) {
      return this.client;
    }

    // If connection is in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Start new connection attempt
    this.connectionPromise = this._connectWithRetry();

    try {
      this.client = await this.connectionPromise;
      return this.client;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Internal method to connect with retry logic
   * @private
   * @returns {Promise<Object>} Connected client instance
   */
  async _connectWithRetry() {
    this.isConnecting = true;
    this.retryCount = 0;

    while (this.retryCount < RETRY_CONFIG.maxAttempts) {
      try {
        const client = await this._attemptConnection();
        this.lastConnectionError = null;
        this.retryCount = 0;
        this.isConnecting = false;
        return client;
      } catch (error) {
        this.lastConnectionError = error;
        this.retryCount++;

        if (this.retryCount >= RETRY_CONFIG.maxAttempts) {
          this.isConnecting = false;
          throw HulyError.connection('Huly platform', error);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, this.retryCount - 1),
          RETRY_CONFIG.maxDelay
        );

        console.log(`Connection attempt ${this.retryCount} failed, retrying in ${delay}ms...`);
        await this._sleep(delay);
      }
    }

    this.isConnecting = false;
    throw HulyError.connection('Huly platform', this.lastConnectionError);
  }

  /**
   * Attempt a single connection to Huly
   * @private
   * @returns {Promise<Object>} Connected client instance
   */
  async _attemptConnection() {
    const timeoutMs = RETRY_CONFIG.connectionTimeout;
    const transactorUrl = this.transactorUrl;
    const publicUrl = process.env.HULY_PUBLIC_URL || this.config.url;

    try {
      const client = await Promise.race([
        connect(this.config.url, {
          email: this.config.email,
          password: this.config.password,
          workspace: this.config.workspace,
          socketFactory: (url) => {
            if (transactorUrl && publicUrl) {
              const publicWs = publicUrl.replace(/^http/, 'ws') + '/_transactor';
              const rewritten = url.replace(publicWs, transactorUrl);
              if (rewritten !== url) {
                console.log(`[HulyClient] Rewriting WS URL to internal: ${transactorUrl}`);
                return new WebSocket(rewritten);
              }
            }
            return new WebSocket(url);
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      await this._verifyConnection(client);

      return client;
    } catch (error) {
      console.error('Connection attempt failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify that the connection is working
   * @private
   * @param {Object} client - Client instance to verify
   * @returns {Promise<void>}
   */
  async _verifyConnection(client) {
    try {
      // Try a simple operation to verify connection
      // This uses the account module to check if we can access account info
      const accountModule = await import('@hcengineering/core');
      const _core = accountModule.default || accountModule;

      // Just check if we can access the hierarchy
      const hierarchy = client.getHierarchy();
      if (!hierarchy) {
        throw new Error('Unable to access client hierarchy');
      }
    } catch (error) {
      throw new Error(`Connection verification failed: ${error.message}`);
    }
  }

  /**
   * Check if client is connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    if (!this.client) return false;

    try {
      // Check actual WebSocket state via SDK internals:
      // PlatformClientImpl.connection → Client → .getConnection() → ClientConnection.isConnected()
      // ClientConnection.isConnected() checks websocket.readyState === OPEN && helloReceived
      const conn = this.client.connection?.getConnection?.();
      if (conn && typeof conn.isConnected === 'function') {
        return conn.isConnected();
      }

      // Fallback: check cached hierarchy (weaker - doesn't detect dead websocket)
      const hierarchy = this.client.getHierarchy();
      return hierarchy !== null && hierarchy !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get the connected client instance
   * @returns {Promise<Object>} Connected client instance
   * @throws {HulyError} If not connected
   */
  async getClient() {
    if (!this.isConnected()) {
      return this.connect();
    }
    return this.client;
  }

  /**
   * Disconnect from Huly platform
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.connectionPromise) {
      // Wait for any pending connection to complete
      try {
        await this.connectionPromise;
      } catch {
        // Ignore connection errors during disconnect
      }
    }

    if (this.client) {
      try {
        if (typeof this.client.close === 'function') {
          await this.client.close();
        } else if (typeof this.client.disconnect === 'function') {
          await this.client.disconnect();
        }
      } catch (error) {
        console.error('Error during disconnect:', error);
      } finally {
        this.client = null;
        this.connectionPromise = null;
        this.isConnecting = false;
      }
    }
  }

  /**
   * Reconnect to Huly platform
   * @returns {Promise<Object>} New client instance
   */
  async reconnect() {
    await this.disconnect();
    return this.connect();
  }

  /**
   * Execute a function with automatic reconnection on failure
   * @param {Function} fn - Function to execute with client
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<*>} Result of the function
   */
  /**
   * Acquire a slot from the concurrency semaphore
   * @private
   */
  async _acquireSlot() {
    if (this.activeRequests < CONCURRENCY_CONFIG.maxConcurrent) {
      this.activeRequests++;
      return;
    }

    // Wait in queue for a slot
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.requestQueue.indexOf(resolver);
        if (idx > -1) this.requestQueue.splice(idx, 1);
        reject(new Error('Request queue timeout - too many concurrent requests'));
      }, CONCURRENCY_CONFIG.queueTimeout);

      const resolver = () => {
        clearTimeout(timeout);
        this.activeRequests++;
        resolve();
      };

      this.requestQueue.push(resolver);
    });
  }

  /**
   * Release a slot back to the concurrency semaphore
   * @private
   */
  _releaseSlot() {
    this.activeRequests--;
    if (this.requestQueue.length > 0 && this.activeRequests < CONCURRENCY_CONFIG.maxConcurrent) {
      const next = this.requestQueue.shift();
      next();
    }
  }

  async withClient(fn, maxRetries = 1) {
    // Acquire concurrency slot before executing
    await this._acquireSlot();

    let lastError;

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const client = await this.getClient();
          return await fn(client);
        } catch (error) {
          lastError = error;

          // Check if error is connection-related
          if (this._isConnectionError(error) && attempt < maxRetries) {
            console.log(
              `Operation failed due to connection error, reconnecting (attempt ${attempt + 1}/${maxRetries})...`
            );
            await this.reconnect();
          } else {
            throw error;
          }
        }
      }

      throw lastError;
    } finally {
      // Always release the slot
      this._releaseSlot();
    }
  }

  /**
   * Check if an error is connection-related
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if connection-related
   */
  _isConnectionError(error) {
    const connectionKeywords = [
      'connection',
      'disconnect',
      'econnrefused',
      'etimedout',
      'enetunreach',
      'socket',
      'websocket',
      'network',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return connectionKeywords.some((keyword) => errorMessage.includes(keyword));
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update the transactor URL (used for failover and migrate-back)
   * @param {string} url - New transactor WebSocket URL
   */
  setTransactorUrl(url) {
    this.transactorUrl = url;
  }

  /**
   * Get connection status information
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      connected: this.isConnected(),
      connecting: this.isConnecting,
      retryCount: this.retryCount,
      lastError: this.lastConnectionError?.message || null,
      transactorUrl: this.transactorUrl || null,
      config: {
        url: this.config.url,
        email: this.config.email,
        workspace: this.config.workspace,
      },
    };
  }
}

// Factory function for creating HulyClient instances
export function createHulyClient(config) {
  return new HulyClient(config);
}
