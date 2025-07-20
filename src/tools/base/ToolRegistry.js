/**
 * Tool Registry System
 *
 * Manages registration, discovery, and execution of MCP tools
 */

import { createErrorResponse } from './ToolInterface.js';

/**
 * Tool Registry class
 * Singleton pattern for managing all registered tools
 */
export class ToolRegistry {
  constructor() {
    /** @type {Map<string, import('./ToolInterface').Tool>} */
    this.tools = new Map();

    /** @type {Map<string, string>} */
    this.categories = new Map();
  }

  /**
   * Register a tool
   * @param {import('./ToolInterface').Tool} tool - Tool to register
   * @param {string} [category] - Optional category (e.g., 'issues', 'projects')
   * @throws {Error} If tool is invalid or name conflicts
   */
  register(tool, category = 'general') {
    if (!tool || !tool.definition || !tool.handler) {
      throw new Error('Invalid tool: must have definition and handler');
    }

    const { name } = tool.definition;

    if (this.tools.has(name)) {
      throw new Error(`Tool already registered: ${name}`);
    }

    // Validate tool definition
    this.validateToolDefinition(tool.definition);

    // Register the tool
    this.tools.set(name, tool);
    this.categories.set(name, category);

    console.log(`Registered tool: ${name} (${category})`);
  }

  /**
   * Register multiple tools at once
   * @param {Array<{tool: import('./ToolInterface').Tool, category?: string}>} tools
   */
  registerMany(tools) {
    for (const { tool, category } of tools) {
      this.register(tool, category);
    }
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {import('./ToolInterface').Tool|null}
   */
  get(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Check if a tool exists
   * @param {string} name - Tool name
   * @returns {boolean}
   */
  has(name) {
    return this.tools.has(name);
  }

  /**
   * Get all tool definitions
   * @returns {Array<import('./ToolInterface').ToolDefinition>}
   */
  getAllDefinitions() {
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  /**
   * Get tools by category
   * @param {string} category - Category name
   * @returns {Array<import('./ToolInterface').Tool>}
   */
  getByCategory(category) {
    const tools = [];
    for (const [name, cat] of this.categories) {
      if (cat === category) {
        const tool = this.tools.get(name);
        if (tool) tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Get all categories
   * @returns {Array<string>}
   */
  getCategories() {
    return [...new Set(this.categories.values())];
  }

  /**
   * Execute a tool
   * @param {string} name - Tool name
   * @param {Object} args - Tool arguments
   * @param {import('./ToolInterface').ToolContext} context - Execution context
   * @returns {Promise<import('./ToolInterface').ToolResponse>}
   */
  async execute(name, args, context) {
    const tool = this.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Run custom validation if provided
    if (tool.validate) {
      const errors = tool.validate(args);
      if (errors) {
        return createErrorResponse(`Validation failed: ${JSON.stringify(errors)}`);
      }
    }

    // Execute the tool handler
    try {
      return await tool.handler(args, context);
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return createErrorResponse(error);
    }
  }

  /**
   * Validate tool definition
   * @param {import('./ToolInterface').ToolDefinition} definition
   * @throws {Error} If definition is invalid
   */
  validateToolDefinition(definition) {
    if (!definition.name || typeof definition.name !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    if (!definition.description || typeof definition.description !== 'string') {
      throw new Error('Tool description must be a non-empty string');
    }

    if (!definition.inputSchema || typeof definition.inputSchema !== 'object') {
      throw new Error('Tool inputSchema must be an object');
    }

    if (definition.inputSchema.type !== 'object') {
      throw new Error('Tool inputSchema.type must be "object"');
    }

    if (
      !definition.inputSchema.properties ||
      typeof definition.inputSchema.properties !== 'object'
    ) {
      throw new Error('Tool inputSchema.properties must be an object');
    }
  }

  /**
   * Clear all registered tools
   * Useful for testing
   */
  clear() {
    this.tools.clear();
    this.categories.clear();
  }

  /**
   * Get registry statistics
   * @returns {Object}
   */
  getStats() {
    const categories = this.getCategories();
    const categoryStats = {};

    for (const category of categories) {
      categoryStats[category] = this.getByCategory(category).length;
    }

    return {
      totalTools: this.tools.size,
      categories: categoryStats,
    };
  }
}

// Create singleton instance
const registry = new ToolRegistry();

// Export singleton
export default registry;

/**
 * Create a new registry instance (for testing)
 * @returns {ToolRegistry}
 */
export function createRegistry() {
  return new ToolRegistry();
}
