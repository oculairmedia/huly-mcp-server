/**
 * StdioTransport - Standard I/O transport for MCP
 *
 * Implements MCP communication over stdin/stdout
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BaseTransport } from './BaseTransport.js';

export class StdioTransport extends BaseTransport {
  constructor(server) {
    super(server);
    this.transport = new StdioServerTransport();
    this.running = false;
  }

  /**
   * Start the stdio transport
   * @returns {Promise<void>}
   */
  async start() {
    if (this.running) {
      throw new Error('StdioTransport is already running');
    }

    try {
      await this.server.connect(this.transport);
      this.running = true;

      // In stdio mode, we don't log to console as it interferes with the protocol
      // The transport will handle all communication
    } catch (error) {
      throw new Error(`Failed to start StdioTransport: ${error.message}`);
    }
  }

  /**
   * Stop the stdio transport
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.running) {
      return;
    }

    try {
      // The SDK's stdio transport doesn't have an explicit stop method
      // It will be cleaned up when the process exits
      this.running = false;
    } catch (error) {
      throw new Error(`Failed to stop StdioTransport: ${error.message}`);
    }
  }

  /**
   * Get the transport type
   * @returns {string}
   */
  getType() {
    return 'stdio';
  }

  /**
   * Check if transport is running
   * @returns {boolean}
   */
  isRunning() {
    return this.running;
  }
}