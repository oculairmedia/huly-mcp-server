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
import { createMCPHandler, toolDefinitions } from './src/protocol/index.js';
import { TransportFactory } from './src/transport/index.js';
import { getConfigManager } from './src/config/index.js';
import statusManager from './StatusManager.js';

// Create issueService instance with statusManager
const issueService = createIssueService(statusManager);

// Get configuration manager instance
const configManager = getConfigManager();

class HulyMCPServer {
  constructor() {
    this.configManager = configManager;
    const serverInfo = this.configManager.getServerInfo();
    
    this.server = new Server(
      {
        name: serverInfo.name,
        version: serverInfo.version,
        description: this.configManager.get('server.description')
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.hulyClientWrapper = createHulyClient(this.configManager.getHulyConfig());
    
    this.services = {
      projectService,
      issueService
    };
    
    // Initialize MCP protocol handler
    this.mcpHandler = createMCPHandler(this.server, {
      ...this.services,
      hulyClientWrapper: this.hulyClientWrapper
    });
    
    this.transport = null;
  }

  async cleanup() {
    // Stop transport if running
    if (this.transport && this.transport.isRunning()) {
      await this.transport.stop();
    }
    
    // Disconnect from Huly
    if (this.hulyClientWrapper) {
      await this.hulyClientWrapper.disconnect();
    }
  }

  async run(transportType = 'stdio') {
    // Set up cleanup handlers
    process.on('SIGINT', async () => {
      console.log('Shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });

    // Create transport based on type
    const transportOptions = {
      toolDefinitions,
      hulyClientWrapper: this.hulyClientWrapper,
      services: this.services,
      port: this.configManager.get('transport.http.port')
    };
    
    this.transport = TransportFactory.create(transportType, this.server, transportOptions);
    
    // Start the transport
    try {
      await this.transport.start();
      
      // Only log for HTTP transport; stdio transport should not log
      if (transportType === 'http') {
        console.log(`Huly MCP Server started with ${transportType} transport`);
      }
    } catch (error) {
      console.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const transportArg = args.find(arg => arg.startsWith('--transport='));
const transportType = transportArg ? transportArg.split('=')[1] : configManager.get('transport.defaultType');

// Validate transport type
if (!TransportFactory.isSupported(transportType)) {
  console.error(`Invalid transport type: ${transportType}`);
  console.error(`Supported types: ${TransportFactory.getSupportedTypes().join(', ')}`);
  process.exit(1);
}

// Run the server
const server = new HulyMCPServer();
server.run(transportType).catch(console.error);