#!/usr/bin/env node

/**
 * Huly MCP Server
 *
 * Provides MCP tools for interacting with Huly project management platform
 * using the compatible SDK version 0.6.500
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createHulyClient } from './src/core/index.js';
import { projectService, createIssueService } from './src/services/index.js';
import { createMCPHandler } from './src/protocol/index.js';
import { getAllToolDefinitions } from './src/tools/index.js';
import { TransportFactory } from './src/transport/index.js';
import { getConfigManager } from './src/config/index.js';
import { createLoggerWithConfig } from './src/utils/index.js';
import statusManager from './StatusManager.js';

// Create issueService instance with statusManager
const issueService = createIssueService(statusManager);

// Get configuration manager instance
const configManager = getConfigManager();

// Create logger instance
const logger = createLoggerWithConfig(configManager);

class HulyMCPServer {
  constructor() {
    this.configManager = configManager;
    this.logger = logger;
    const serverInfo = this.configManager.getServerInfo();

    this.server = new Server(
      {
        name: serverInfo.name,
        version: serverInfo.version,
        description: this.configManager.get('server.description'),
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.logger.info('Initializing Huly MCP Server');

    this.hulyClientWrapper = createHulyClient(this.configManager.getHulyConfig());

    const hulyConfig = this.configManager.getHulyConfig();
    this.logger.debug('Huly client configured', {
      url: hulyConfig.url,
      workspace: hulyConfig.workspace,
    });

    this.services = {
      projectService,
      issueService,
    };

    // Initialize MCP protocol handler
    this.mcpHandler = createMCPHandler(this.server, {
      ...this.services,
      hulyClientWrapper: this.hulyClientWrapper,
    });

    this.transport = null;
  }

  async cleanup() {
    this.logger.info('Shutting down Huly MCP Server');

    // Stop transport if running
    if (this.transport && this.transport.isRunning()) {
      await this.transport.stop();
    }

    // Disconnect from Huly
    if (this.hulyClientWrapper) {
      await this.hulyClientWrapper.disconnect();
      this.logger.debug('Disconnected from Huly platform');
    }
  }

  async run(transportType = 'stdio') {
    // Set up cleanup handlers
    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT signal');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM signal');
      await this.cleanup();
      process.exit(0);
    });

    this.logger.info(`Starting server with ${transportType} transport`);

    // Create transport based on type
    const transportOptions = {
      toolDefinitions: getAllToolDefinitions(), // Get from new tool system
      hulyClientWrapper: this.hulyClientWrapper,
      services: this.services,
      port: this.configManager.get('transport.http.port'),
      logger: this.logger.child('transport'),
    };

    this.transport = TransportFactory.create(transportType, this.server, transportOptions);

    // Start the transport
    try {
      await this.transport.start();

      // Only log for HTTP transport; stdio transport should not log
      if (transportType === 'http') {
        this.logger.info(`Huly MCP Server started with ${transportType} transport`);
      }
    } catch (error) {
      this.logger.error('Failed to start server', error);
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const transportArg = args.find((arg) => arg.startsWith('--transport='));
const transportType = transportArg
  ? transportArg.split('=')[1]
  : configManager.get('transport.defaultType');

// Validate transport type
if (!TransportFactory.isSupported(transportType)) {
  logger.error(`Invalid transport type: ${transportType}`);
  logger.error(`Supported types: ${TransportFactory.getSupportedTypes().join(', ')}`);
  process.exit(1);
}

// Run the server
const server = new HulyMCPServer();
server.run(transportType).catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
