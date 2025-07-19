/**
 * BaseTransport - Abstract base class for MCP transports
 *
 * Defines the interface that all transport implementations must follow
 */

export class BaseTransport {
  constructor(server) {
    if (new.target === BaseTransport) {
      throw new Error('BaseTransport is an abstract class and cannot be instantiated directly');
    }
    this.server = server;
  }

  /**
   * Start the transport and begin listening for connections
   * @returns {Promise<void>}
   */
  async start() {
    throw new Error('start() method must be implemented by subclass');
  }

  /**
   * Stop the transport and clean up resources
   * @returns {Promise<void>}
   */
  async stop() {
    throw new Error('stop() method must be implemented by subclass');
  }

  /**
   * Get transport type identifier
   * @returns {string}
   */
  getType() {
    throw new Error('getType() method must be implemented by subclass');
  }

  /**
   * Check if transport is running
   * @returns {boolean}
   */
  isRunning() {
    throw new Error('isRunning() method must be implemented by subclass');
  }
}