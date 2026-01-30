/**
 * HulyClientPool - Connection pool for Huly platform
 *
 * Maintains multiple HulyClient connections to handle concurrent requests
 * without overwhelming a single WebSocket connection
 */

import { HulyClient } from './HulyClient.js';

const DEFAULT_POOL_SIZE = parseInt(process.env.HULY_POOL_SIZE || '2', 10);
const REQUEST_TIMEOUT = 30000;
const POOL_INIT_TIMEOUT = parseInt(process.env.HULY_POOL_INIT_TIMEOUT_MS || '20000', 10);

export class HulyClientPool {
  constructor(config, poolSize = DEFAULT_POOL_SIZE) {
    this.config = config;
    this.poolSize = poolSize;
    this.clients = [];
    this.clientStatus = []; // Track which clients are busy
    this.requestQueue = [];
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initializePool();
    await this.initPromise;
    this.initialized = true;
  }

  async _initializePool() {
    console.log(`Initializing Huly client pool with ${this.poolSize} connections...`);

    const initPromises = [];
    for (let i = 0; i < this.poolSize; i++) {
      const client = new HulyClient(this.config);
      this.clients.push(client);
      this.clientStatus.push({ busy: false, requestCount: 0 });
      initPromises.push(
        client.connect().catch((err) => {
          console.error(`Failed to initialize client ${i}:`, err.message);
          return null;
        })
      );
    }

    try {
      await Promise.race([
        Promise.all(initPromises),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Pool initialization timeout after ${POOL_INIT_TIMEOUT}ms`)),
            POOL_INIT_TIMEOUT
          )
        ),
      ]);
    } catch (err) {
      console.error(`Pool initialization failed: ${err.message}`);
    }

    const connectedCount = this.clients.filter((c) => c.isConnected()).length;
    console.log(
      `Huly client pool initialized: ${connectedCount}/${this.poolSize} connections ready`
    );
  }

  /**
   * Get an available client from the pool
   * Uses round-robin with least-busy selection
   */
  _getAvailableClientIndex() {
    // First try to find a non-busy client
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.clientStatus[i].busy && this.clients[i].isConnected()) {
        return i;
      }
    }

    // If all busy, find the one with least requests
    let minRequests = Infinity;
    let minIndex = 0;
    for (let i = 0; i < this.poolSize; i++) {
      if (this.clients[i].isConnected() && this.clientStatus[i].requestCount < minRequests) {
        minRequests = this.clientStatus[i].requestCount;
        minIndex = i;
      }
    }

    return minIndex;
  }

  /**
   * Execute a function with a pooled client
   * Automatically handles client selection and release
   */
  async withClient(fn) {
    await this.initialize();

    if (!this.isConnected()) {
      throw new Error(
        'No Huly client connections available. The platform may be unreachable or the SDK version is incompatible.'
      );
    }

    const clientIndex = this._getAvailableClientIndex();
    const client = this.clients[clientIndex];
    const status = this.clientStatus[clientIndex];

    status.busy = true;
    status.requestCount++;

    try {
      const hulyClient = await client.getClient();
      const result = await Promise.race([
        fn(hulyClient),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
        ),
      ]);
      return result;
    } catch (error) {
      // If connection error, try to reconnect this client
      if (this._isConnectionError(error)) {
        console.log(`Client ${clientIndex} connection error, reconnecting...`);
        try {
          await client.reconnect();
        } catch (reconnectErr) {
          console.error(`Failed to reconnect client ${clientIndex}:`, reconnectErr.message);
        }
      }
      throw error;
    } finally {
      status.busy = false;
      status.requestCount--;
    }
  }

  /**
   * Execute with automatic retry across different clients
   */
  async withClientRetry(fn, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.withClient(fn);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          console.log(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
          await this._sleep(100 * (attempt + 1)); // Brief backoff
        }
      }
    }

    throw lastError;
  }

  _isConnectionError(error) {
    const keywords = ['connection', 'disconnect', 'timeout', 'socket', 'websocket', 'network'];
    const msg = error.message?.toLowerCase() || '';
    return keywords.some((k) => msg.includes(k));
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get a client from the pool (compatible with HulyClient API)
   * Returns the underlying Huly client for direct API calls
   */
  async getClient() {
    await this.initialize();

    if (!this.isConnected()) {
      throw new Error(
        'No Huly client connections available. The platform may be unreachable or the SDK version is incompatible.'
      );
    }

    const clientIndex = this._getAvailableClientIndex();
    const client = this.clients[clientIndex];
    return client.getClient();
  }

  /**
   * Check if any client is connected
   */
  isConnected() {
    return this.clients.some((c) => c.isConnected());
  }

  /**
   * Get pool status
   */
  getStatus() {
    return {
      poolSize: this.poolSize,
      initialized: this.initialized,
      clients: this.clientStatus.map((status, i) => ({
        index: i,
        connected: this.clients[i]?.isConnected() || false,
        busy: status.busy,
        requestCount: status.requestCount,
      })),
    };
  }

  /**
   * Disconnect all clients
   */
  async disconnect() {
    console.log('Disconnecting Huly client pool...');
    await Promise.all(this.clients.map((c) => c.disconnect().catch(() => {})));
    this.clients = [];
    this.clientStatus = [];
    this.initialized = false;
    this.initPromise = null;
  }
}

// Singleton pool instance
let poolInstance = null;

export function getHulyClientPool(config, poolSize) {
  if (!poolInstance) {
    poolInstance = new HulyClientPool(config, poolSize);
  }
  return poolInstance;
}

export function resetHulyClientPool() {
  if (poolInstance) {
    poolInstance.disconnect();
    poolInstance = null;
  }
}

/**
 * Create a new pool instance (factory function)
 */
export function createHulyClientPool(config, poolSize = DEFAULT_POOL_SIZE) {
  return new HulyClientPool(config, poolSize);
}
