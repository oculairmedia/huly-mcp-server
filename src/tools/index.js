/**
 * Tool Registry Entry Point
 * 
 * This module provides the main entry point for the tool system.
 * It automatically discovers and loads all tools from subdirectories.
 */

import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import registry from './base/ToolRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Logger will be initialized lazily to avoid config dependency at import time
let logger = null;

async function getLogger() {
  if (!logger) {
    try {
      const { createLoggerWithConfig } = await import('../utils/index.js');
      const { getConfigManager } = await import('../config/index.js');
      logger = createLoggerWithConfig(getConfigManager()).child('tool-loader');
    } catch (error) {
      // Fallback to console if logger fails
      logger = {
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug
      };
    }
  }
  return logger;
}

/**
 * Tool categories to load
 */
const TOOL_CATEGORIES = [
  'projects',
  'issues', 
  'components',
  'milestones',
  'github',
  'comments'
];

/**
 * Load all tools from a category directory
 * @param {string} category - Category name
 * @returns {Promise<number>} Number of tools loaded
 */
async function loadCategoryTools(category) {
  const categoryPath = join(__dirname, category);
  let loadedCount = 0;
  const log = await getLogger();
  
  try {
    // Check if category directory exists
    statSync(categoryPath);
  } catch (error) {
    log.warn(`Category directory not found: ${category}`);
    return 0;
  }

  try {
    // Read all files in the category directory
    const files = readdirSync(categoryPath);
    
    for (const file of files) {
      // Skip index.js and non-js files
      if (file === 'index.js' || !file.endsWith('.js')) {
        continue;
      }
      
      const filePath = join(categoryPath, file);
      
      try {
        // Dynamically import the tool module
        const toolModule = await import(`file://${filePath}`);
        
        // Check if it exports the required properties
        if (toolModule.definition && toolModule.handler) {
          // Create tool object
          const tool = {
            definition: toolModule.definition,
            handler: toolModule.handler,
            validate: toolModule.validate
          };
          
          // Register the tool
          registry.register(tool, category);
          loadedCount++;
        } else {
          log.warn(`Tool file missing exports: ${file}`);
        }
      } catch (error) {
        log.error(`Failed to load tool from ${file}:`, error);
      }
    }
  } catch (error) {
    log.error(`Failed to read category directory ${category}:`, error);
  }
  
  return loadedCount;
}

/**
 * Initialize all tools
 * @returns {Promise<void>}
 */
export async function initializeTools() {
  const log = await getLogger();
  log.info('Initializing tool system...');
  
  let totalLoaded = 0;
  
  // Load tools from each category
  for (const category of TOOL_CATEGORIES) {
    const count = await loadCategoryTools(category);
    totalLoaded += count;
    
    if (count > 0) {
      log.info(`Loaded ${count} tools from ${category}`);
    }
  }
  
  log.info(`Tool system initialized: ${totalLoaded} tools loaded`);
  
  // Log statistics
  const stats = registry.getStats();
  log.debug('Tool registry statistics:', stats);
}

/**
 * Get all tool definitions for MCP
 * @returns {Array<import('./base/ToolInterface').ToolDefinition>}
 */
export function getAllToolDefinitions() {
  return registry.getAllDefinitions();
}

/**
 * Execute a tool by name
 * @param {string} name - Tool name
 * @param {Object} args - Tool arguments
 * @param {import('./base/ToolInterface').ToolContext} context - Execution context
 * @returns {Promise<import('./base/ToolInterface').ToolResponse>}
 */
export async function executeTool(name, args, context) {
  return registry.execute(name, args, context);
}

/**
 * Check if a tool exists
 * @param {string} name - Tool name
 * @returns {boolean}
 */
export function hasTool(name) {
  return registry.has(name);
}

/**
 * Get tools by category
 * @param {string} category - Category name
 * @returns {Array<import('./base/ToolInterface').Tool>}
 */
export function getToolsByCategory(category) {
  return registry.getByCategory(category);
}

// Export the registry for direct access if needed
export { registry };

// Export base classes and utilities
export { BaseTool, createToolResponse, createErrorResponse } from './base/ToolInterface.js';
export { ToolRegistry, createRegistry } from './base/ToolRegistry.js';