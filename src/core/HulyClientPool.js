/**
 * HulyClientPool - Connection pool for Huly platform
 *
 * Maintains multiple HulyClient connections to handle concurrent requests
 * without overwhelming a single WebSocket connection
 */

import { HulyClient } from './HulyClient.js';

const REQUEST_TIMEOUT = 30000;
const POOL_INIT_TIMEOUT = parseInt(process.env.HULY_POOL_INIT_TIMEOUT_MS || '20000', 10);
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HULY_HEALTH_CHECK_INTERVAL_MS || '30000', 10);
const RECONNECT_BACKOFF_MS = 5000;
const PRIMARY_PROBE_INTERVAL = 3; // Every N health checks, try migrating back to primary

function parseTransactorUrls() {
  const urlsEnv = process.env.HULY_TRANSACTOR_URLS;
  if (urlsEnv) {
    const urls = urlsEnv
      .split(';')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length > 0) return urls;
  }
  const singleUrl = process.env.HULY_TRANSACTOR_URL;
  return singleUrl ? [singleUrl] : [];
}

function getDefaultPoolSize() {
  const explicit = process.env.HULY_POOL_SIZE;
  if (explicit) return parseInt(explicit, 10);
  const urls = parseTransactorUrls();
  return urls.length > 0 ? urls.length : 2;
}

export class HulyClientPool {
  constructor(config, poolSize) {
    this.config = config;
    this.transactorUrls = parseTransactorUrls();
    this.poolSize = poolSize || getDefaultPoolSize();
    this.clients = [];
    this.clientStatus = [];
    this.requestQueue = [];
    this.initialized = false;
    this.initPromise = null;
    this._healthCheckInterval = null;
    this._reconnecting = false;
    this._healthCheckCount = 0;
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
    const hasMultipleTransactors = this.transactorUrls.length > 1;
    console.log(
      `Initializing Huly client pool: ${this.poolSize} clients across ${this.transactorUrls.length} transactor(s)`
    );

    const initPromises = [];
    for (let i = 0; i < this.poolSize; i++) {
      const primaryUrl =
        this.transactorUrls.length > 0 ? this.transactorUrls[i % this.transactorUrls.length] : null;

      const clientConfig = { ...this.config, transactorUrl: primaryUrl };
      const client = new HulyClient(clientConfig);
      this.clients.push(client);
      this.clientStatus.push({
        busy: false,
        requestCount: 0,
        primaryUrl,
        currentUrl: primaryUrl,
        onFailover: false,
      });

      if (hasMultipleTransactors) {
        console.log(`  Client ${i} → ${primaryUrl}`);
      }

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

    this._startHealthCheck();
  }

  /**
   * Background health check loop - detects dead clients and reconnects them.
   * This is THE critical self-healing mechanism that prevents permanent pool death
   * after transient infrastructure failures (CRDB stalls, transactor restarts, etc.)
   */
  async _reconnectClient(idx, reason) {
    const status = this.clientStatus[idx];
    const urlsToTry = [];

    if (status.primaryUrl) {
      urlsToTry.push(status.primaryUrl);
    }

    if (status.currentUrl && status.currentUrl !== status.primaryUrl) {
      urlsToTry.push(status.currentUrl);
    }

    for (const url of this.transactorUrls) {
      if (!urlsToTry.includes(url)) urlsToTry.push(url);
    }

    for (const url of urlsToTry) {
      try {
        this.clients[idx].setTransactorUrl(url);
        await this.clients[idx].reconnect();
        status.currentUrl = url;
        status.onFailover = Boolean(status.primaryUrl && url !== status.primaryUrl);
        console.log(`[HulyClientPool] ✅ Client ${idx} reconnected (${reason}) → ${url}`);
        return true;
      } catch (err) {
        console.error(
          `[HulyClientPool] ❌ Client ${idx} reconnect failed (${reason}) → ${url}: ${err.message}`
        );
      }
      await this._sleep(RECONNECT_BACKOFF_MS);
    }

    return false;
  }

  async _migrateBackToPrimary(idx) {
    const status = this.clientStatus[idx];
    if (!status.primaryUrl || status.currentUrl === status.primaryUrl) return false;

    const previousUrl = status.currentUrl;

    try {
      this.clients[idx].setTransactorUrl(status.primaryUrl);
      await this.clients[idx].reconnect();
      status.currentUrl = status.primaryUrl;
      status.onFailover = false;
      console.log(
        `[HulyClientPool] ✅ Client ${idx} migrated back to primary → ${status.primaryUrl}`
      );
      return true;
    } catch (err) {
      console.error(
        `[HulyClientPool] ❌ Client ${idx} migrate-back failed → ${status.primaryUrl}: ${err.message}`
      );
      try {
        this.clients[idx].setTransactorUrl(previousUrl);
        await this.clients[idx].reconnect();
        status.currentUrl = previousUrl;
        status.onFailover = true;
      } catch (fallbackErr) {
        console.error(
          `[HulyClientPool] ❌ Client ${idx} failed to restore failover → ${previousUrl}: ${fallbackErr.message}`
        );
      }
    }

    return false;
  }

  _startHealthCheck() {
    if (this._healthCheckInterval) return;

    this._healthCheckInterval = setInterval(async () => {
      if (this._reconnecting) return;

      this._healthCheckCount++;
      const shouldProbePrimary =
        this.transactorUrls.length > 1 && this._healthCheckCount % PRIMARY_PROBE_INTERVAL === 0;

      const deadClients = [];
      for (let i = 0; i < this.clients.length; i++) {
        if (!this.clients[i].isConnected()) {
          deadClients.push(i);
        }
      }

      if (deadClients.length === 0 && !shouldProbePrimary) return;

      this._reconnecting = true;

      if (deadClients.length > 0) {
        const aliveCount = this.clients.length - deadClients.length;
        console.log(
          `[HulyClientPool] Health check: ${deadClients.length} dead client(s) detected ` +
            `(${aliveCount}/${this.clients.length} alive). Attempting reconnection...`
        );

        for (const idx of deadClients) {
          await this._reconnectClient(idx, 'health-check');
        }
      }

      if (shouldProbePrimary) {
        for (let i = 0; i < this.clients.length; i++) {
          if (this.clientStatus[i].onFailover) {
            await this._migrateBackToPrimary(i);
          }
        }
      }

      const nowAlive = this.clients.filter((c) => c.isConnected()).length;
      console.log(
        `[HulyClientPool] Health check complete: ${nowAlive}/${this.clients.length} alive`
      );
      this._reconnecting = false;
    }, HEALTH_CHECK_INTERVAL);

    // Ensure the interval doesn't prevent process exit
    if (this._healthCheckInterval.unref) {
      this._healthCheckInterval.unref();
    }

    console.log(
      `[HulyClientPool] Background health check started (every ${HEALTH_CHECK_INTERVAL / 1000}s)`
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
      console.log('[HulyClientPool] No connected clients, attempting emergency reconnection...');
      await this._reconnectAll();

      if (!this.isConnected()) {
        throw new Error(
          'No Huly client connections available after reconnection attempt. The platform may be unreachable.'
        );
      }
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

  async _reconnectAll() {
    for (let i = 0; i < this.clients.length; i++) {
      if (this.clients[i].isConnected()) continue;
      try {
        const recovered = await this._reconnectClient(i, 'emergency');
        if (recovered) return;
      } catch (err) {
        console.error(
          `[HulyClientPool] ❌ Emergency reconnect: client ${i} failed: ${err.message}`
        );
      }
    }
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
      console.log(
        '[HulyClientPool] No connected clients in getClient(), attempting emergency reconnection...'
      );
      await this._reconnectAll();

      if (!this.isConnected()) {
        throw new Error(
          'No Huly client connections available after reconnection attempt. The platform may be unreachable.'
        );
      }
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
        primaryUrl: status.primaryUrl || null,
        currentUrl: status.currentUrl || null,
        onFailover: status.onFailover,
      })),
    };
  }

  /**
   * Disconnect all clients
   */
  async disconnect() {
    console.log('Disconnecting Huly client pool...');
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
      console.log('[HulyClientPool] Background health check stopped');
    }
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
export function createHulyClientPool(config, poolSize = getDefaultPoolSize()) {
  return new HulyClientPool(config, poolSize);
}
