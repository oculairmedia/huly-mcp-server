/**
 * TransportFactory - Factory for creating transport instances
 * 
 * Creates appropriate transport instances based on configuration
 */

import { StdioTransport } from './StdioTransport.js';
import { HttpTransport } from './HttpTransport.js';

export class TransportFactory {
  /**
   * Create a transport instance based on type
   * @param {string} type - Transport type ('stdio' or 'http')
   * @param {Object} server - MCP server instance
   * @param {Object} options - Transport-specific options
   * @returns {BaseTransport} Transport instance
   */
  static create(type, server, options = {}) {
    switch (type.toLowerCase()) {
      case 'stdio':
        return new StdioTransport(server);
        
      case 'http':
        return new HttpTransport(server, options);
        
      default:
        throw new Error(`Unknown transport type: ${type}. Supported types: stdio, http`);
    }
  }

  /**
   * Get list of supported transport types
   * @returns {string[]}
   */
  static getSupportedTypes() {
    return ['stdio', 'http'];
  }

  /**
   * Check if a transport type is supported
   * @param {string} type - Transport type to check
   * @returns {boolean}
   */
  static isSupported(type) {
    return this.getSupportedTypes().includes(type.toLowerCase());
  }
}