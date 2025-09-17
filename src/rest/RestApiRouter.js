/**
 * RestApiRouter - Express router for REST API endpoints
 *
 * Provides REST API access to Huly tools separately from MCP protocol
 */

import express from 'express';
import { RestApiHandler } from './RestApiHandler.js';
import { RestApiMiddleware } from './RestApiMiddleware.js';

export class RestApiRouter {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.services = options.services || {};
    this.hulyClientWrapper = options.hulyClientWrapper;

    // Create router instance
    this.router = express.Router();

    // Initialize handler and middleware
    this.handler = new RestApiHandler({
      services: this.services,
      hulyClientWrapper: this.hulyClientWrapper,
      logger: this.logger.child('rest-handler'),
    });

    this.middleware = new RestApiMiddleware({
      logger: this.logger.child('rest-middleware'),
    });

    this.setupRoutes();
  }

  /**
   * Set up REST API routes
   */
  setupRoutes() {
    // Apply middleware
    this.router.use(this.middleware.requestLogger());
    this.router.use(this.middleware.corsHandler());
    this.router.use(express.json({ limit: '10mb' }));

    // API routes
    this.setupToolRoutes();
    this.setupHealthRoute();

    // Apply error handling middleware last
    this.router.use(this.middleware.errorHandler());
  }

  /**
   * Set up tool-related routes
   */
  setupToolRoutes() {
    // GET /api/tools - List all available tools
    this.router.get('/tools', async (req, res, next) => {
      try {
        const { category, search } = req.query;
        const result = await this.handler.listTools({ category, search });

        res.json({
          success: true,
          data: result,
          metadata: {
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
        });
      } catch (error) {
        next(error);
      }
    });

    // POST /api/tools/:toolName - Execute a specific tool
    this.router.post('/tools/:toolName', async (req, res, next) => {
      try {
        const { toolName } = req.params;
        const { arguments: toolArgs = {} } = req.body;

        const startTime = Date.now();
        const result = await this.handler.executeTool(toolName, toolArgs);
        const executionTime = Date.now() - startTime;

        res.json({
          success: true,
          data: {
            toolName,
            result,
            executionTime,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
        });
      } catch (error) {
        next(error);
      }
    });

    // GET /api/tools/:toolName - Execute a tool with query parameters (for simple tools)
    this.router.get('/tools/:toolName', async (req, res, next) => {
      try {
        const { toolName } = req.params;
        const toolArgs = req.query; // Use query parameters as tool arguments

        const startTime = Date.now();
        const result = await this.handler.executeTool(toolName, toolArgs);
        const executionTime = Date.now() - startTime;

        res.json({
          success: true,
          data: {
            toolName,
            result,
            executionTime,
          },
          metadata: {
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
        });
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * Set up health check route for REST API
   */
  setupHealthRoute() {
    this.router.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          service: 'huly-rest-api',
          transport: 'http',
          uptime: process.uptime(),
          toolCount: this.handler.getToolCount(),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0',
        },
      });
    });
  }

  /**
   * Get the Express router instance
   * @returns {express.Router}
   */
  getRouter() {
    return this.router;
  }

  /**
   * Get router statistics
   * @returns {Object}
   */
  getStats() {
    return {
      toolCount: this.handler.getToolCount(),
      uptime: process.uptime(),
    };
  }
}

/**
 * Factory function to create REST API router
 * @param {Object} options - Router options
 * @returns {express.Router}
 */
export function createRestApiRouter(options = {}) {
  const restApiRouter = new RestApiRouter(options);
  return restApiRouter.getRouter();
}