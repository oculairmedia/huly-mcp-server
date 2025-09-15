/**
 * Prompts System Entry Point
 * Initializes and exports the prompt system for MCP integration
 */

import { promptRegistry, registerPrompt, registerWizardPrompt } from './base/PromptRegistry.js';
import { BasePrompt, WizardPrompt, PromptUtils } from './base/PromptInterface.js';
import { createLoggerWithConfig } from '../utils/index.js';
import { getConfigManager } from '../config/index.js';

// Initialize logger (lazy-loaded to avoid config issues in tests)
let logger;

/**
 * Initialize logger if not already done
 * @private
 */
function _initLogger() {
  if (!logger) {
    try {
      const configManager = getConfigManager();
      logger = createLoggerWithConfig(configManager).child('prompts-system');
    } catch (error) {
      // Fallback to console in test environment
      logger = {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      };
    }
  }
}

/**
 * Initialize the prompts system
 * @returns {Promise<void>}
 */
export async function initializePrompts() {
  _initLogger();

  try {
    logger.info('Starting prompt system initialization...');

    await promptRegistry.initialize();

    const stats = promptRegistry.getStatistics();
    logger.info('Prompt system initialized successfully', stats);
  } catch (error) {
    logger.error('Failed to initialize prompt system:', error);
    throw error;
  }
}

/**
 * Get all prompt definitions for MCP
 * @returns {Object[]} Array of MCP-compatible prompt definitions
 */
export function getAllPromptDefinitions() {
  return promptRegistry.getMCPPromptList();
}

/**
 * Execute a prompt by name
 * @param {string} name - Prompt name
 * @param {Object} args - Execution arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Execution result
 */
export async function executePrompt(name, args = {}, context = {}) {
  return promptRegistry.execute(name, args, context);
}

/**
 * Check if a prompt exists
 * @param {string} name - Prompt name
 * @returns {boolean} Whether prompt exists
 */
export function hasPrompt(name) {
  return promptRegistry.has(name);
}

/**
 * Get prompt by name
 * @param {string} name - Prompt name
 * @returns {BasePrompt|null} Prompt instance or null
 */
export function getPrompt(name) {
  return promptRegistry.get(name);
}

/**
 * Get all registered prompt names
 * @returns {string[]} Array of prompt names
 */
export function getPromptNames() {
  return promptRegistry.getNames();
}

/**
 * Get prompts by category
 * @param {string} category - Category name
 * @returns {BasePrompt[]} Array of prompts in category
 */
export function getPromptsByCategory(category) {
  return promptRegistry.getByCategory(category);
}

/**
 * Get prompt categories
 * @returns {string[]} Array of category names
 */
export function getPromptCategories() {
  return promptRegistry.getCategories();
}

/**
 * Get prompt metadata
 * @param {string} name - Prompt name
 * @returns {Object|null} Prompt metadata
 */
export function getPromptMetadata(name) {
  return promptRegistry.getMetadata(name);
}

/**
 * Get registry statistics
 * @returns {Object} Registry statistics
 */
export function getPromptStatistics() {
  return promptRegistry.getStatistics();
}

/**
 * Validate all prompts
 * @returns {Object} Validation results
 */
export function validateAllPrompts() {
  return promptRegistry.validate();
}

/**
 * Clear prompts (useful for testing)
 * @param {string} [category] - Optional category to clear
 */
export function clearPrompts(category = null) {
  promptRegistry.clear(category);
}

// Export the registry instance for advanced usage
export { promptRegistry };

// Export base classes for creating custom prompts
export { BasePrompt, WizardPrompt, PromptUtils };

// Export registration helpers
export { registerPrompt, registerWizardPrompt };

// Export default (the registry)
export default promptRegistry;