/**
 * Resource Registry and Loader
 * Manages all MCP resources for the Huly MCP Server
 */

import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLoggerWithConfig } from '../utils/index.js';
import { getConfigManager } from '../config/index.js';
import { registerResource, registerResourceTemplate } from '../handlers/resources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger
const configManager = getConfigManager();
const logger = createLoggerWithConfig(configManager).child('resource-loader');

/**
 * Resource categories to load
 */
const RESOURCE_CATEGORIES = ['workflows', 'projects', 'system'];

/**
 * Load all resources from a category directory
 * @param {string} category - Category name
 * @returns {Promise<number>} Number of resources loaded
 */
async function loadCategoryResources(category) {
  const categoryPath = join(__dirname, category);
  let loadedCount = 0;

  try {
    // Check if category directory exists
    statSync(categoryPath);
  } catch {
    logger.warn(`Resource category directory not found: ${category}`);
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
        // Dynamically import the resource module
        const resourceModule = await import(`file://${filePath}`);

        // Check if it exports registerResources function
        if (resourceModule.registerResources) {
          await resourceModule.registerResources();
          loadedCount++;
        } else {
          logger.warn(`Resource file missing registerResources export: ${file}`);
        }
      } catch (error) {
        logger.error(`Failed to load resource from ${file}:`, error);
      }
    }
  } catch (error) {
    logger.error(`Failed to read resource category directory ${category}:`, error);
  }

  return loadedCount;
}

/**
 * Initialize all resources
 * @returns {Promise<void>}
 */
export async function initializeResources() {
  logger.info('Initializing MCP resource system...');

  let totalLoaded = 0;

  // Load resources from each category
  for (const category of RESOURCE_CATEGORIES) {
    const count = await loadCategoryResources(category);
    totalLoaded += count;

    if (count > 0) {
      logger.info(`Loaded ${count} resource modules from ${category}`);
    }
  }

  logger.info(`Resource system initialized: ${totalLoaded} resource modules loaded`);
}

/**
 * Register a workflow resource
 * @param {Object} definition - Resource definition
 */
export function registerWorkflowResource(definition) {
  registerResource({
    uri: `huly://workflows/${definition.name}`,
    name: definition.name,
    title: definition.title,
    description: definition.description,
    mimeType: 'application/json',
    handler: definition.handler,
    annotations: {
      category: 'workflow',
      ...definition.annotations,
    },
  });
}

/**
 * Register a project resource template
 * @param {Object} definition - Resource template definition
 */
export function registerProjectResourceTemplate(definition) {
  registerResourceTemplate({
    uriTemplate: `huly://projects/{project_id}/${definition.name}`,
    name: `project_${definition.name}`,
    title: definition.title,
    description: definition.description,
    mimeType: definition.mimeType || 'application/json',
  });
}

/**
 * Register a system resource
 * @param {Object} definition - Resource definition
 */
export function registerSystemResource(definition) {
  registerResource({
    uri: `huly://system/${definition.name}`,
    name: definition.name,
    title: definition.title,
    description: definition.description,
    mimeType: definition.mimeType || 'application/json',
    handler: definition.handler,
    annotations: {
      category: 'system',
      ...definition.annotations,
    },
  });
}
