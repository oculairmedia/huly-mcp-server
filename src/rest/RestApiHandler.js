/**
 * RestApiHandler - Business logic for REST API operations
 *
 * Bridges REST requests to the existing MCP tool system
 */

import { getAllToolDefinitions, initializeTools, registry } from '../tools/index.js';

export class RestApiHandler {
  constructor(options = {}) {
    this.services = options.services || {};
    this.hulyClientWrapper = options.hulyClientWrapper;
    this.logger = options.logger || console;
    this.initialized = false;

    // Use the global tool registry
    this.toolRegistry = registry;
    this.toolDefinitions = [];
  }

  /**
   * Initialize tools in the registry
   */
  async initializeTools() {
    if (this.initialized) return;

    try {
      // Check if tools are already loaded in the global registry
      let existingDefinitions = getAllToolDefinitions();

      if (existingDefinitions.length === 0) {
        // Only initialize if no tools are loaded yet
        this.logger.debug('No tools found in registry, initializing tool system...');
        await initializeTools();
        existingDefinitions = getAllToolDefinitions();
      } else {
        this.logger.debug(`Found ${existingDefinitions.length} existing tools in registry, skipping initialization`);
      }

      // Get the tool definitions from the global registry
      this.toolDefinitions = existingDefinitions;

      this.initialized = true;
      this.logger.info(`Initialized ${this.toolDefinitions.length} tools for REST API`);
    } catch (error) {
      this.logger.error('Failed to initialize tools:', error);
      throw error;
    }
  }

  /**
   * List all available tools with optional filtering
   * @param {Object} filters - Filter options
   * @param {string} filters.category - Filter by tool category
   * @param {string} filters.search - Search in tool names/descriptions
   * @returns {Object} Tool listing with metadata
   */
  async listTools(filters = {}) {
    try {
      // Ensure tools are initialized
      await this.initializeTools();

      const { category, search } = filters;
      let tools = this.toolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        category: this.getToolCategory(tool.name),
        inputSchema: tool.inputSchema,
        outputFormat: 'object',
      }));

      // Apply category filter
      if (category) {
        tools = tools.filter(tool =>
          tool.category.toLowerCase() === category.toLowerCase()
        );
      }

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        tools = tools.filter(tool =>
          tool.name.toLowerCase().includes(searchLower) ||
          tool.description.toLowerCase().includes(searchLower)
        );
      }

      // Get unique categories
      const categories = [...new Set(this.toolDefinitions.map(tool =>
        this.getToolCategory(tool.name)
      ))].sort();

      return {
        tools,
        count: tools.length,
        categories,
        filters: {
          category: category || null,
          search: search || null,
        },
      };
    } catch (error) {
      this.logger.error('Error listing tools:', error);
      throw new Error('Failed to list tools');
    }
  }

  /**
   * Execute a tool with given arguments
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} toolArgs - Arguments for the tool
   * @returns {Object} Tool execution result
   */
  async executeTool(toolName, toolArgs = {}) {
    try {
      // Ensure tools are initialized
      await this.initializeTools();

      // Validate tool exists
      const tool = this.toolRegistry.get(toolName);
      if (!tool) {
        const error = new Error(`Tool '${toolName}' not found`);
        error.code = 'TOOL_NOT_FOUND';
        error.statusCode = 404;
        error.details = {
          availableTools: this.toolDefinitions.map(t => t.name).slice(0, 10),
        };
        throw error;
      }

      // Validate arguments
      this.validateToolArguments(toolName, toolArgs);

      // Create execution context
      const context = {
        ...this.services,
        hulyClientWrapper: this.hulyClientWrapper,
        logger: this.logger.child(`tool-${toolName}`),
      };

      // Execute the tool
      this.logger.info(`Executing tool: ${toolName}`, { args: toolArgs });
      const result = await this.toolRegistry.execute(toolName, toolArgs, context);

      // Transform result to REST format
      return this.formatToolResult(result);

    } catch (error) {
      this.logger.error(`Error executing tool ${toolName}:`, error);

      // Re-throw known errors
      if (error.code) {
        throw error;
      }

      // Handle Huly API errors
      if (error.message?.includes('Huly API')) {
        const hulyError = new Error('Huly API error: ' + error.message);
        hulyError.code = 'HULY_API_ERROR';
        hulyError.statusCode = 502;
        throw hulyError;
      }

      // Handle validation errors
      if (error.message?.includes('validation') || error.message?.includes('required')) {
        const validationError = new Error('Invalid arguments: ' + error.message);
        validationError.code = 'VALIDATION_ERROR';
        validationError.statusCode = 400;
        throw validationError;
      }

      // Generic server error
      const serverError = new Error('Tool execution failed');
      serverError.code = 'INTERNAL_ERROR';
      serverError.statusCode = 500;
      throw serverError;
    }
  }

  /**
   * Validate tool arguments against schema
   * @param {string} toolName - Tool name
   * @param {Object} args - Arguments to validate
   */
  validateToolArguments(toolName, args) {
    const toolDef = this.toolDefinitions.find(t => t.name === toolName);
    if (!toolDef?.inputSchema?.properties) {
      return; // No schema to validate against
    }

    const { properties, required = [] } = toolDef.inputSchema;

    // Check required fields
    for (const field of required) {
      if (!(field in args)) {
        const error = new Error(`Required field '${field}' is missing`);
        error.code = 'VALIDATION_ERROR';
        error.statusCode = 400;
        error.details = {
          field,
          required: required,
          provided: Object.keys(args),
        };
        throw error;
      }
    }

    // Basic type validation for provided fields
    for (const [field, value] of Object.entries(args)) {
      if (properties[field]) {
        const expectedType = properties[field].type;
        const actualType = typeof value;

        if (expectedType === 'string' && actualType !== 'string') {
          const error = new Error(`Field '${field}' must be a string`);
          error.code = 'VALIDATION_ERROR';
          error.statusCode = 400;
          throw error;
        }

        if (expectedType === 'number' && actualType !== 'number') {
          const error = new Error(`Field '${field}' must be a number`);
          error.code = 'VALIDATION_ERROR';
          error.statusCode = 400;
          throw error;
        }
      }
    }
  }

  /**
   * Get tool category based on tool name
   * @param {string} toolName - Tool name
   * @returns {string} Category name
   */
  getToolCategory(toolName) {
    if (toolName.includes('project')) return 'projects';
    if (toolName.includes('issue')) return 'issues';
    if (toolName.includes('template')) return 'templates';
    if (toolName.includes('component')) return 'components';
    if (toolName.includes('milestone')) return 'milestones';
    if (toolName.includes('comment')) return 'comments';
    if (toolName.includes('github')) return 'github';
    if (toolName.includes('employee') || toolName.includes('account')) return 'accounts';
    if (toolName.includes('validation') || toolName.includes('deletion')) return 'validation';
    return 'general';
  }

  /**
   * Format tool result for REST response
   * @param {any} result - Raw tool result
   * @returns {any} Formatted result
   */
  formatToolResult(result) {
    // If result is already properly formatted, return as-is
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return result;
    }

    // For arrays or primitives, wrap in data object
    return {
      data: result,
    };
  }

  /**
   * Get count of available tools
   * @returns {number} Tool count
   */
  getToolCount() {
    return this.toolDefinitions.length;
  }

  /**
   * Get tool registry instance
   * @returns {ToolRegistry} Tool registry
   */
  getToolRegistry() {
    return this.toolRegistry;
  }
}