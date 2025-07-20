/**
 * Base interfaces and types for MCP tools
 *
 * This module defines the core interfaces that all tools must implement
 * to be compatible with the tool registry system.
 */

/**
 * Tool definition interface
 * @typedef {Object} ToolDefinition
 * @property {string} name - Unique tool name (e.g., 'huly_create_issue')
 * @property {string} description - Human-readable description
 * @property {Object} inputSchema - JSON Schema for tool parameters
 */

/**
 * Tool context provided to handlers
 * @typedef {Object} ToolContext
 * @property {Object} client - Huly client instance
 * @property {Object} services - Service instances (issueService, projectService)
 * @property {Object} config - Tool configuration
 * @property {Object} logger - Logger instance
 */

/**
 * Tool handler function
 * @typedef {Function} ToolHandler
 * @param {Object} args - Tool arguments validated against inputSchema
 * @param {ToolContext} context - Tool execution context
 * @returns {Promise<Object>} Tool response
 */

/**
 * Complete tool module interface
 * @typedef {Object} Tool
 * @property {ToolDefinition} definition - Tool metadata and schema
 * @property {ToolHandler} handler - Tool execution function
 * @property {Function} [validate] - Optional custom validation
 */

/**
 * Base class for tool implementations
 * Provides common functionality and validation
 */
export class BaseTool {
  /**
   * @param {ToolDefinition} definition - Tool definition
   */
  constructor(definition) {
    this.definition = definition;
    this.validateDefinition();
  }

  /**
   * Validate tool definition
   * @throws {Error} If definition is invalid
   */
  validateDefinition() {
    if (!this.definition.name) {
      throw new Error('Tool name is required');
    }
    if (!this.definition.description) {
      throw new Error('Tool description is required');
    }
    if (!this.definition.inputSchema) {
      throw new Error('Tool inputSchema is required');
    }
    if (this.definition.inputSchema.type !== 'object') {
      throw new Error('Tool inputSchema must be an object schema');
    }
  }

  /**
   * Default handler - must be overridden
   * @param {Object} args - Tool arguments
   * @param {ToolContext} context - Execution context
   * @returns {Promise<Object>}
   */
  async handler(args, context) {
    throw new Error(`Handler not implemented for tool: ${this.definition.name}`);
  }

  /**
   * Optional validation hook
   * @param {Object} args - Tool arguments
   * @returns {Object|null} Validation errors or null
   */
  validate(args) {
    return null;
  }

  /**
   * Export tool for registry
   * @returns {Tool}
   */
  export() {
    return {
      definition: this.definition,
      handler: this.handler.bind(this),
      validate: this.validate.bind(this),
    };
  }
}

/**
 * Tool response format
 * @typedef {Object} ToolResponse
 * @property {Array<Object>} content - Response content
 * @property {string} content[].type - Content type (usually 'text')
 * @property {string} content[].text - Response text
 */

/**
 * Create a standard tool response
 * @param {string} text - Response text
 * @returns {ToolResponse}
 */
export function createToolResponse(text) {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Tool error response
 * @param {Error|string} error - Error object or message
 * @returns {ToolResponse}
 */
export function createErrorResponse(error) {
  const message = error instanceof Error ? error.message : error;
  return createToolResponse(`Error: ${message}`);
}
