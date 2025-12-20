/**
 * HttpTransport - HTTP transport for MCP
 *
 * Implements MCP communication over HTTP using Express and StreamableHTTPServerTransport
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { BaseTransport } from './BaseTransport.js';
import { createRestApiRouter } from '../rest/RestApiRouter.js';
import { RestApiHandler } from '../rest/RestApiHandler.js';
import { HulyError } from '../core/index.js';
import { withTimeout } from '../utils/timeoutPromise.js';

/**
 * Simple in-memory event store for SSE recovery with bounded memory usage
 */
class InMemoryEventStore {
  constructor(maxEventsPerStream = 100, maxTotalEvents = 1000) {
    this.events = new Map();
    this.maxEventsPerStream = maxEventsPerStream;
    this.maxTotalEvents = maxTotalEvents;
  }

  generateEventId(streamId) {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  getStreamIdFromEventId(eventId) {
    const parts = eventId.split('_');
    return parts.length > 0 ? parts[0] : '';
  }

  async storeEvent(streamId, message) {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message, timestamp: Date.now() });

    // Enforce per-stream limit
    this._enforceStreamLimit(streamId);

    // Enforce total event limit
    this._enforceTotalLimit();

    return eventId;
  }

  _enforceStreamLimit(streamId) {
    const streamEvents = [...this.events.entries()]
      .filter(([_, data]) => data.streamId === streamId)
      .sort((a, b) => b[1].timestamp - a[1].timestamp);

    if (streamEvents.length > this.maxEventsPerStream) {
      const toDelete = streamEvents.slice(this.maxEventsPerStream);
      for (const [eventId] of toDelete) {
        this.events.delete(eventId);
      }
    }
  }

  _enforceTotalLimit() {
    if (this.events.size <= this.maxTotalEvents) {
      return;
    }

    const sortedEvents = [...this.events.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = sortedEvents.slice(0, sortedEvents.length - this.maxTotalEvents);

    for (const [eventId] of toDelete) {
      this.events.delete(eventId);
    }
  }

  async replayEventsAfter(lastEventId, { send }) {
    if (!lastEventId || !this.events.has(lastEventId)) {
      return '';
    }

    const streamId = this.getStreamIdFromEventId(lastEventId);
    if (!streamId) {
      return '';
    }

    let foundLastEvent = false;
    const sortedEvents = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [eventId, { streamId: eventStreamId, message }] of sortedEvents) {
      if (eventStreamId !== streamId) {
        continue;
      }

      if (eventId === lastEventId) {
        foundLastEvent = true;
        continue;
      }

      if (foundLastEvent) {
        await send(eventId, message);
      }
    }
    return streamId;
  }

  clearStream(streamId) {
    const toDelete = [...this.events.entries()]
      .filter(([_, data]) => data.streamId === streamId)
      .map(([eventId]) => eventId);

    for (const eventId of toDelete) {
      this.events.delete(eventId);
    }
  }
}

export class HttpTransport extends BaseTransport {
  constructor(server, options = {}) {
    super(server);
    this.port = options.port || process.env.PORT || 3457;
    this.app = null;
    this.httpServer = null;
    this.running = false;
    this.transports = {}; // Session ID -> { transport, lastActivity, createdAt } mapping
    this.sessionQueues = new Map(); // Session ID -> queue for serializing POST requests
    this.cleanupInterval = null; // Interval for cleaning up stale sessions
    this.logger = options.logger || console;
    if (typeof this.logger.child !== 'function') {
      this.logger.child = () => this.logger;
    }

    // Session TTL configuration (default 2 hours)
    this.sessionTTLMs = parseInt(process.env.HULY_SESSION_TTL_MS || '7200000', 10);
    // Cleanup interval (default 5 minutes)
    this.cleanupIntervalMs = parseInt(process.env.HULY_SESSION_CLEANUP_INTERVAL_MS || '300000', 10);

    // Store options for REST API setup
    this.options = options;
    this.toolDefinitions = options.toolDefinitions || [];
    this.services = options.services || {};
    this.hulyClientWrapper = options.hulyClientWrapper;
    this.restApiHandler = new RestApiHandler({
      services: this.services,
      hulyClientWrapper: this.hulyClientWrapper,
      logger: this.logger.child('rest-handler'),
    });

    // Note: services and hulyClientWrapper are placeholders at startup.
    // They are updated after background initialization via updateContext().
  }

  /**
   * Get transport data for a session, updating lastActivity
   * @param {string} sessionId
   * @returns {Object|null} transport object or null if not found
   */
  getTransport(sessionId) {
    const data = this.transports[sessionId];
    if (data) {
      data.lastActivity = Date.now();
      return data.transport;
    }
    return null;
  }

  /**
   * Store a transport with metadata
   * @param {string} sessionId
   * @param {Object} transport
   */
  setTransport(sessionId, transport) {
    const now = Date.now();
    this.transports[sessionId] = {
      transport,
      createdAt: now,
      lastActivity: now,
    };
  }

  /**
   * Remove a transport
   * @param {string} sessionId
   */
  removeTransport(sessionId) {
    delete this.transports[sessionId];
  }

  /**
   * Check if a transport exists
   * @param {string} sessionId
   * @returns {boolean}
   */
  hasTransport(sessionId) {
    return !!this.transports[sessionId];
  }

  /**
   * Get count of active transports
   * @returns {number}
   */
  getTransportCount() {
    return Object.keys(this.transports).length;
  }

  /**
   * Clean up stale sessions that have been idle longer than TTL
   */
  cleanupStaleSessions() {
    const now = Date.now();
    const staleSessionIds = [];

    for (const [sessionId, data] of Object.entries(this.transports)) {
      const idleTime = now - data.lastActivity;
      if (idleTime > this.sessionTTLMs) {
        staleSessionIds.push({ sessionId, idleTime, createdAt: data.createdAt });
      }
    }

    if (staleSessionIds.length > 0) {
      this.logger.info(
        `[Session Cleanup] Found ${staleSessionIds.length} stale sessions to clean up`
      );

      for (const { sessionId, idleTime } of staleSessionIds) {
        try {
          const data = this.transports[sessionId];
          if (data && data.transport && data.transport.onclose) {
            data.transport.onclose();
          }
          this.removeTransport(sessionId);
          this.logger.info(
            `[Session Cleanup] Removed stale session ${sessionId} (idle for ${Math.round(idleTime / 1000 / 60)} minutes)`
          );
        } catch (error) {
          this.logger.error(`[Session Cleanup] Error cleaning up session ${sessionId}:`, error);
          // Still remove it to prevent memory leak
          this.removeTransport(sessionId);
        }
      }
    }

    // Log current transport count periodically
    const currentCount = this.getTransportCount();
    if (currentCount > 0) {
      this.logger.debug(`[Session Cleanup] Active sessions: ${currentCount}`);
    }
  }

  /**
   * Start the session cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      return;
    }

    this.logger.info(
      `[Session Cleanup] Starting cleanup interval (TTL: ${this.sessionTTLMs / 1000 / 60} min, interval: ${this.cleanupIntervalMs / 1000 / 60} min)`
    );

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, this.cleanupIntervalMs);

    // Don't prevent Node from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop the session cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('[Session Cleanup] Stopped cleanup interval');
    }
  }

  /**
   * Run a function serialized per-session to avoid concurrent handleRequest calls on the same transport
   * @param {string} sessionId
   * @param {() => Promise<any>} fn
   */
  async runInSessionQueue(sessionId, fn) {
    if (!sessionId) {
      return fn();
    }
    let queue = this.sessionQueues.get(sessionId);
    if (!queue) {
      // Simple promise chain queue
      queue = { tail: Promise.resolve() };
      this.sessionQueues.set(sessionId, queue);
    }
    const prev = queue.tail;
    let resolveNext;
    const next = new Promise((r) => (resolveNext = r));
    queue.tail = next;
    try {
      await prev; // wait previous task
      return await fn();
    } finally {
      resolveNext();
      // Cleanup if no further tasks enqueued soon
      // Defer cleanup slightly to avoid churn
      setTimeout(() => {
        const q = this.sessionQueues.get(sessionId);
        if (q && q.tail === next) {
          this.sessionQueues.delete(sessionId);
        }
      }, 30000).unref?.();
    }
  }

  /**
   * Start the HTTP transport
   * @returns {Promise<void>}
   */
  async start() {
    if (this.running) {
      throw new Error('HTTP transport is already running');
    }

    this.app = express();

    // Configure allowed origins (env var comma-separated, '*' to allow all)
    const envAllowed = (process.env.HULY_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const defaultAllowed = ['http://localhost', 'http://127.0.0.1', 'http://192.168.50.90'];
    const allowedOrigins = envAllowed.length > 0 ? envAllowed : defaultAllowed;
    const allowAll = allowedOrigins.includes('*');

    const isOriginAllowed = (origin) => {
      if (!origin) return true; // allow curl/CLI with no Origin
      if (origin === 'null') return true; // allow file:// or app-webviews
      if (allowAll) return true;
      return allowedOrigins.some((allowed) => origin.startsWith(allowed));
    };

    // Security: Validate Origin header to prevent DNS rebinding attacks
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (!isOriginAllowed(origin)) {
        this.logger.warn(`Blocked request from unauthorized origin: ${origin}`);
        return res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Forbidden: Invalid origin',
          },
          id: null,
        });
      }
      next();
    });

    // Middleware - CORS configuration for MCP session management
    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) return callback(null, true);
          return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: ['Content-Type', 'mcp-session-id', 'mcp-protocol-version'],
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      })
    );

    // Handle CORS preflight for MCP
    this.app.options('/mcp', (req, res) => {
      res.sendStatus(204);
    });
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    this.setupRoutes();
    this.setupRestApi();

    return new Promise((resolve, reject) => {
      this.httpServer = this.app.listen(this.port, '0.0.0.0', () => {
        // Tune server timeouts for long-lived SSE connections
        try {
          const keepAliveMs = parseInt(process.env.HULY_HTTP_KEEPALIVE_MS || '120000', 10);
          const headersTimeoutMs = parseInt(
            process.env.HULY_HTTP_HEADERS_TIMEOUT_MS || '130000',
            10
          );
          const requestTimeoutMs =
            process.env.HULY_HTTP_REQUEST_TIMEOUT_MS !== undefined
              ? parseInt(process.env.HULY_HTTP_REQUEST_TIMEOUT_MS, 10)
              : 0; // 0 disables in Node 18+

          if (typeof this.httpServer.setTimeout === 'function') {
            this.httpServer.setTimeout(0); // Disable legacy inactivity timeout
          }
          this.httpServer.requestTimeout = requestTimeoutMs;
          this.httpServer.keepAliveTimeout = keepAliveMs;
          this.httpServer.headersTimeout = headersTimeoutMs;
        } catch (e) {
          this.logger.warn('Failed to apply HTTP server timeout tuning:', e);
        }

        this.running = true;
        this.startCleanupInterval();
        this.logger.info(`HTTP transport started on port ${this.port}`);
        this.logger.info(`Health check: http://localhost:${this.port}/health`);
        this.logger.info(`MCP endpoint: http://localhost:${this.port}/mcp`);
        this.logger.info(`REST API: http://localhost:${this.port}/api/tools`);
        this.logger.info(`Metrics: http://localhost:${this.port}/metrics`);
        this.logger.info('Protocol version: 2025-06-18');
        this.logger.info('Security: Origin validation enabled, DNS rebinding protection active');
        resolve();
      });

      this.httpServer.on('error', (error) => {
        this.running = false;
        reject(new Error(`Failed to start HTTP transport: ${error.message}`));
      });
    });
  }

  /**
   * Stop the HTTP transport
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.running) {
      return;
    }

    // Stop cleanup interval
    this.stopCleanupInterval();

    // Clean up all transports
    for (const [sessionId, data] of Object.entries(this.transports)) {
      try {
        this.logger.info(`Cleaning up session: ${sessionId}`);
        if (data.transport && data.transport.onclose) {
          data.transport.onclose();
        }
      } catch (error) {
        this.logger.error(`Error cleaning up session ${sessionId}:`, error);
      }
    }

    return new Promise((resolve, reject) => {
      if (this.httpServer) {
        this.httpServer.close((error) => {
          if (error) {
            reject(new Error(`Failed to stop HTTP transport: ${error.message}`));
          } else {
            this.running = false;
            this.httpServer = null;
            this.app = null;
            this.transports = {};
            this.logger.info('HTTP transport stopped');
            resolve();
          }
        });
      } else {
        this.running = false;
        resolve();
      }
    });
  }

  /**
   * Get the transport type
   * @returns {string}
   */
  getType() {
    return 'http';
  }

  /**
   * Check if transport is running
   * @returns {boolean}
   */
  isRunning() {
    return this.running;
  }

  /**
   * Set up HTTP routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'huly-mcp-server',
        transport: 'streamable_http',
        protocol_version: '2025-06-18',
        sessions: this.getTransportCount(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        security: {
          origin_validation: true,
          localhost_binding: true,
        },
      });
    });

    // Metrics endpoint for monitoring
    this.app.get('/metrics', (req, res) => {
      const now = Date.now();
      const sessions = [];

      for (const [sessionId, data] of Object.entries(this.transports)) {
        sessions.push({
          sessionId: `${sessionId.substring(0, 8)}...`, // Truncate for privacy
          idleSeconds: Math.round((now - data.lastActivity) / 1000),
          ageSeconds: Math.round((now - data.createdAt) / 1000),
        });
      }

      // Sort by idle time descending
      sessions.sort((a, b) => b.idleSeconds - a.idleSeconds);

      res.json({
        service: 'huly-mcp-server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        sessions: {
          count: this.getTransportCount(),
          ttlMinutes: Math.round(this.sessionTTLMs / 1000 / 60),
          cleanupIntervalMinutes: Math.round(this.cleanupIntervalMs / 1000 / 60),
          details: sessions,
        },
        queues: {
          count: this.sessionQueues.size,
        },
      });
    });

    // Protocol version validation middleware
    this.app.use('/mcp', (req, res, next) => {
      // Skip validation for initialization requests
      if (req.method === 'POST' && req.body && req.body.method === 'initialize') {
        return next();
      }

      const protocolVersion = req.headers['mcp-protocol-version'];
      if (protocolVersion && protocolVersion !== '2025-06-18' && protocolVersion !== '2025-03-26') {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Unsupported MCP protocol version: ${protocolVersion}`,
          },
          id: null,
        });
      }
      next();
    });

    // Main MCP endpoint - POST
    this.app.post('/mcp', async (req, res) => {
      const method = req.body?.method || 'unknown';
      const requestId = req.body?.id;
      this.logger.info(
        `[MCP-POST] Received request: method=${method}, id=${requestId}, session=${req.headers['mcp-session-id']}`
      );

      try {
        // Check for session ID
        const sessionId = req.headers['mcp-session-id'];
        let transport;

        this.logger.debug(
          `[MCP-POST] Session check: sessionId=${sessionId}, hasTransport=${this.hasTransport(sessionId)}, totalTransports=${this.getTransportCount()}`
        );

        if (sessionId && this.hasTransport(sessionId)) {
          // Reuse existing transport (also updates lastActivity)
          this.logger.debug(`[MCP-POST] Reusing transport for session: ${sessionId}`);
          transport = this.getTransport(sessionId);
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request
          this.logger.debug('[MCP-POST] Creating new transport for initialization');
          const eventStore = new InMemoryEventStore();

          let sessionResolve;
          const _sessionInitialized = new Promise((resolve) => {
            sessionResolve = resolve;
          });

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            eventStore,
            onsessioninitialized: (sessionId) => {
              this.logger.info(`[MCP-POST] Session initialized with ID: ${sessionId}`);
              this.setTransport(sessionId, transport);
              sessionResolve(sessionId);
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.hasTransport(sid)) {
              this.logger.info(
                `[MCP-POST] Transport closed for session ${sid}, removing from transports map`
              );
              eventStore.clearStream(sid);
              this.removeTransport(sid);
            }
          };

          this.logger.debug('[MCP-POST] Connecting transport to MCP server');
          await this.server.connect(transport);

          this.logger.debug('[MCP-POST] Handling initialization request');
          const requestTimeout = parseInt(process.env.HULY_MCP_REQUEST_TIMEOUT_MS || '30000', 10);
          await withTimeout(
            transport.handleRequest(req, res, req.body),
            requestTimeout,
            `MCP initialize request`
          );

          // Session registration happens in callback, don't wait
          this.logger.debug(
            `[MCP-POST] Init request completed, session will register via callback`
          );
          return;
        } else if (sessionId && !this.hasTransport(sessionId)) {
          // Session ID provided but transport not found - might be expired
          this.logger.warn(`[MCP-POST] Session not found: ${sessionId}, method=${method}`);
          res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Session not found. Please re-initialize.',
            },
            id: requestId,
          });
          return;
        } else {
          // No session ID and not an initialization request
          this.logger.warn(
            `[MCP-POST] Invalid request: method=${method}, hasSessionId=${!!sessionId}, isInit=${isInitializeRequest(req.body)}`
          );
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided or session expired',
            },
            id: requestId,
          });
          return;
        }

        // Handle request with existing transport, serialized per-session to avoid concurrent hangs
        this.logger.debug(
          `[MCP-POST] Handling request with existing transport for session: ${sessionId}`
        );
        const computeTimeout = (body) => {
          const base = parseInt(process.env.HULY_MCP_REQUEST_TIMEOUT_MS || '30000', 10);
          try {
            const m = body?.method;
            if (m === 'tools/call') {
              const toolName = body?.params?.name;
              if (toolName === 'huly_entity') {
                const entityType = body?.params?.arguments?.entity_type;
                const operation = body?.params?.arguments?.operation;
                if (entityType === 'comment' && operation === 'create') {
                  return parseInt(process.env.HULY_MCP_TIMEOUT_COMMENT_MS || '120000', 10);
                }
              }
              if (toolName === 'huly_issue_ops') {
                const operation = body?.params?.arguments?.operation;
                if (operation === 'update') {
                  return parseInt(process.env.HULY_MCP_TIMEOUT_ISSUE_UPDATE_MS || '120000', 10);
                }
              }
              if (toolName === 'huly_query') {
                return parseInt(process.env.HULY_MCP_TIMEOUT_QUERY_MS || base.toString(), 10);
              }
            }
          } catch {
            // Ignore parsing errors, use base timeout
          }
          return base;
        };

        const requestTimeout = computeTimeout(req.body);
        this.logger.info(
          `[MCP-POST] About to queue request: method=${method}, id=${requestId}, timeout=${requestTimeout}ms`
        );

        // Track timing for queue wait analysis
        const queueStartTime = Date.now();

        await this.runInSessionQueue(sessionId, async () => {
          const queueWaitTime = Date.now() - queueStartTime;
          this.logger.info(
            `[MCP-POST] Executing queued request: method=${method}, id=${requestId}, queueWaitTime=${queueWaitTime}ms`
          );

          // Adjust timeout to account for queue wait time
          // Add buffer (50%) to prevent timeout during normal operation
          const adjustedTimeout = requestTimeout + queueWaitTime + requestTimeout * 0.5;
          this.logger.debug(
            `[MCP-POST] Adjusted timeout: ${adjustedTimeout}ms (original: ${requestTimeout}ms, queueWait: ${queueWaitTime}ms)`
          );

          await withTimeout(
            transport.handleRequest(req, res, req.body),
            adjustedTimeout,
            `MCP ${method} request`
          );
          this.logger.info(
            `[MCP-POST] Request completed from transport: method=${method}, id=${requestId}`
          );
        });
        this.logger.debug(
          `[MCP-POST] Request handled successfully: method=${method}, id=${requestId}`
        );
      } catch (error) {
        this.logger.error(
          `[MCP-POST] ❌ Error handling MCP request: method=${method}, id=${requestId}`,
          {
            error: error.message,
            stack: error.stack,
            name: error.name,
            headers: req.headers,
            body: req.body,
          }
        );
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: `Internal server error: ${error.message}`,
              data: { errorType: error.name },
            },
            id: requestId || null,
          });
        }
      }
    });

    // MCP endpoint - GET (for SSE streaming)
    this.app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];

      if (!sessionId || !this.hasTransport(sessionId)) {
        return res.status(400).send('Session ID required');
      }

      const transport = this.getTransport(sessionId);
      // Do NOT apply a timeout to the SSE stream; it should remain open
      await transport.handleRequest(req, res);
    });

    // Session termination endpoint - DELETE
    this.app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];

      if (!sessionId) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No session ID provided',
          },
        });
      }

      if (!this.hasTransport(sessionId)) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Session not found',
          },
        });
      }

      try {
        // Clean up the session
        const data = this.transports[sessionId];
        if (data && data.transport && data.transport.onclose) {
          data.transport.onclose();
        }
        this.removeTransport(sessionId);

        this.logger.info(`Session ${sessionId} terminated by client`);
        res.status(200).json({
          jsonrpc: '2.0',
          result: { terminated: true },
        });
      } catch (error) {
        this.logger.error(`Error terminating session ${sessionId}:`, error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error during session termination',
          },
        });
      }
    });
  }

  /**
   * Set up REST API routes
   */
  setupRestApi() {
    try {
      // Create REST API router, sharing the same handler instance with HttpTransport
      // This ensures that when we update the handler context, both use the same instance
      const restApiRouter = createRestApiRouter({
        services: this.services,
        hulyClientWrapper: this.hulyClientWrapper,
        logger: this.logger.child('rest-api'),
        handler: this.restApiHandler, // Pass the shared handler instance
      });

      // Mount REST API at /api
      this.app.use('/api', restApiRouter);

      this.logger.info('REST API routes mounted at /api');
    } catch (error) {
      this.logger.error('Failed to setup REST API:', error);
      throw error;
    }
  }

  /**
   * Execute a tool via the REST API handler
   * @param {string} toolName
   * @param {Object} toolArgs
   * @returns {Promise<Object>}
   */
  async executeTool(toolName, toolArgs = {}) {
    return this.restApiHandler.executeTool(toolName, toolArgs);
  }

  /**
   * Handle errors and format MCP-style responses
   * @param {Object} res - Express response
   * @param {Error} error - Error to handle
   * @param {string|null} id - JSON-RPC id
   */
  handleError(res, error, id = null) {
    if (error instanceof HulyError) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message,
          data: {
            errorCode: error.code,
            details: error.details,
          },
        },
        id,
      });
      return;
    }

    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message || 'Unknown error',
      },
      id,
    });
  }
}
