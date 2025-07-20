/**
 * MCPHandler - Model Context Protocol handler
 *
 * Handles MCP protocol requests and responses, managing tool definitions
 * and request routing to appropriate services.
 */

import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HulyError } from '../core/HulyError.js';
import {
  initializeTools,
  getAllToolDefinitions,
  executeTool as executeRegisteredTool,
  hasTool,
} from '../tools/index.js';
import { createLoggerWithConfig } from '../utils/index.js';
import { getConfigManager } from '../config/index.js';

export class MCPHandler {
  constructor(server, services) {
    this.server = server;
    this.services = services;
    this.logger = createLoggerWithConfig(getConfigManager()).child('mcp-handler');
    this.initialized = false;
    this.setupHandlers();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize the new tool system
      await initializeTools();
      this.initialized = true;
      this.logger.info('Tool system initialized');
    } catch (error) {
      this.logger.error('Failed to initialize tool system:', error);
      throw error;
    }
  }

  setupHandlers() {
    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      await this.initialize();

      // Use new tool system
      const tools = getAllToolDefinitions();
      return { tools };
    });

    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      await this.initialize();

      try {
        if (!hasTool(name)) {
          throw HulyError.invalidValue('tool', name, 'a valid tool name');
        }

        // Use new tool system
        const context = {
          client: null, // Will be set in withClient
          services: this.services,
          config: getConfigManager().getHulyConfig(),
          logger: this.logger.child(name),
        };

        // Execute with client wrapper for reconnection support
        const { hulyClientWrapper } = this.services;
        return await hulyClientWrapper.withClient(async (client) => {
          context.client = client;
          return await executeRegisteredTool(name, args, context);
        });
      } catch (error) {
        // Handle HulyError instances with structured responses
        if (error instanceof HulyError) {
          return error.toMCPResponse();
        }

        // Handle generic errors
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }
}

// Export singleton factory
export function createMCPHandler(server, services) {
  return new MCPHandler(server, services);
}
