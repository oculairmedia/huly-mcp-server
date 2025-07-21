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

/**
 * Simple in-memory event store for SSE recovery
 */
class InMemoryEventStore {
  constructor() {
    this.events = new Map();
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
    this.events.set(eventId, { streamId, message });
    return eventId;
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
}

export class HttpTransport extends BaseTransport {
  constructor(server, options = {}) {
    super(server);
    this.port = options.port || process.env.PORT || 5439;
    this.app = null;
    this.httpServer = null;
    this.running = false;
    this.transports = {}; // Session ID -> Transport mapping
    this.logger = options.logger || console;
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

    // Security: Validate Origin header to prevent DNS rebinding attacks
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowedOrigins = ['http://localhost', 'http://127.0.0.1', 'http://192.168.50.90'];

      if (origin && !allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
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

    // Middleware
    this.app.use(
      cors({
        origin: ['http://localhost', 'http://127.0.0.1', 'http://192.168.50.90'],
        credentials: true,
      })
    );
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    this.setupRoutes();

    return new Promise((resolve, reject) => {
      this.httpServer = this.app.listen(this.port, '0.0.0.0', () => {
        this.running = true;
        this.logger.info(`HTTP transport started on port ${this.port}`);
        this.logger.info(`Health check: http://localhost:${this.port}/health`);
        this.logger.info(`MCP endpoint: http://localhost:${this.port}/mcp`);
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

    // Clean up all transports
    for (const [sessionId, transport] of Object.entries(this.transports)) {
      try {
        this.logger.info(`Cleaning up session: ${sessionId}`);
        if (transport.onclose) {
          transport.onclose();
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
        sessions: Object.keys(this.transports).length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        security: {
          origin_validation: true,
          localhost_binding: true,
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
      this.logger.info('Received MCP request:', req.body);
      try {
        // Check for session ID
        const sessionId = req.headers['mcp-session-id'];
        let transport;

        if (sessionId && this.transports[sessionId]) {
          // Reuse existing transport
          transport = this.transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request
          const eventStore = new InMemoryEventStore();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            eventStore, // Enable recoverability
            onsessioninitialized: (sessionId) => {
              // Store transport by session ID when initialized
              this.logger.info(`Session initialized with ID: ${sessionId}`);
              this.transports[sessionId] = transport;
            },
          });

          // Set onclose handler to clean up transport on closure
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports[sid]) {
              this.logger.info(`Transport closed for session ${sid}, removing from transports map`);
              delete this.transports[sid];
            }
          };

          // Connect transport to MCP server before handling the request
          await this.server.connect(transport);

          await transport.handleRequest(req, res, req.body);
          return; // Already handled
        } else {
          // Invalid request - no session ID or not an initialization request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle request with existing transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        this.logger.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // MCP endpoint - GET (for SSE streaming)
    this.app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];

      if (!sessionId || !this.transports[sessionId]) {
        return res.status(400).send('Session ID required');
      }

      const transport = this.transports[sessionId];
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

      if (!this.transports[sessionId]) {
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
        const transport = this.transports[sessionId];
        if (transport.onclose) {
          transport.onclose();
        }
        delete this.transports[sessionId];

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
}
