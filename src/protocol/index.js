/**
 * Protocol module exports
 *
 * Central export point for MCP protocol handling
 */

export { MCPHandler, createMCPHandler } from './MCPHandler.js';
export {
  toolDefinitions,
  toolMap,
  isValidTool,
  getToolDefinition
} from './toolDefinitions.js';