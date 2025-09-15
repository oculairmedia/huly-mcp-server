/**
 * Prompt Registry System
 * Manages registration, discovery, and execution of MCP prompts
 */

import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HulyError } from '../../core/HulyError.js';
import { BasePrompt, WizardPrompt, PromptUtils } from './PromptInterface.js';
import { createLoggerWithConfig } from '../../utils/index.js';
import { getConfigManager } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger (lazy-loaded to avoid config issues in tests)
let logger;

/**
 * Prompt Registry for managing all prompts
 */
export class PromptRegistry {
  constructor() {
    this.prompts = new Map(); // name -> BasePrompt instance
    this.categories = new Map(); // category -> Set of prompt names
    this.metadata = new Map(); // name -> metadata
    this.initialized = false;

    // Initialize logger lazily
    this._initLogger();
  }

  /**
   * Initialize logger (lazy-loaded to avoid config issues in tests)
   * @private
   */
  _initLogger() {
    if (!logger) {
      try {
        const configManager = getConfigManager();
        logger = createLoggerWithConfig(configManager).child('prompt-registry');
      } catch (_error) {
        // Fallback to console in test environment
        logger = {
          debug: console.debug.bind(console),
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
        };
      }
    }
  }

  /**
   * Register a prompt in the registry
   * @param {BasePrompt} prompt - Prompt to register
   * @param {string} [category='general'] - Prompt category
   * @throws {HulyError} If prompt is invalid or name conflicts
   */
  register(prompt, category = 'general') {
    // Validate prompt instance
    if (!(prompt instanceof BasePrompt)) {
      throw HulyError.invalidValue('prompt', prompt, 'BasePrompt instance');
    }

    // Validate prompt name format
    if (!PromptUtils.isValidPromptName(prompt.name)) {
      throw HulyError.invalidValue('prompt.name', prompt.name, 'valid kebab-case name');
    }

    // Check for name conflicts
    if (this.prompts.has(prompt.name)) {
      throw new HulyError(
        'PROMPT_NAME_CONFLICT',
        `Prompt with name '${prompt.name}' already registered`
      );
    }

    // Register the prompt
    this.prompts.set(prompt.name, prompt);

    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category).add(prompt.name);

    // Store metadata
    this.metadata.set(prompt.name, {
      ...prompt.getMetadata(),
      category,
      registeredAt: new Date().toISOString(),
    });

    logger.debug(`Registered prompt: ${prompt.name} in category: ${category}`);
  }

  /**
   * Unregister a prompt
   * @param {string} name - Prompt name to unregister
   * @returns {boolean} Whether prompt was found and removed
   */
  unregister(name) {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      return false;
    }

    // Remove from prompts map
    this.prompts.delete(name);

    // Remove from metadata
    this.metadata.delete(name);

    // Remove from categories
    for (const [category, promptNames] of this.categories.entries()) {
      if (promptNames.has(name)) {
        promptNames.delete(name);
        // Remove empty categories
        if (promptNames.size === 0) {
          this.categories.delete(category);
        }
        break;
      }
    }

    logger.debug(`Unregistered prompt: ${name}`);
    return true;
  }

  /**
   * Get a registered prompt
   * @param {string} name - Prompt name
   * @returns {BasePrompt|null} Prompt instance or null if not found
   */
  get(name) {
    return this.prompts.get(name) || null;
  }

  /**
   * Check if prompt exists
   * @param {string} name - Prompt name
   * @returns {boolean} Whether prompt exists
   */
  has(name) {
    return this.prompts.has(name);
  }

  /**
   * Get all registered prompt names
   * @returns {string[]} Array of prompt names
   */
  getNames() {
    return Array.from(this.prompts.keys());
  }

  /**
   * Get prompts by category
   * @param {string} category - Category name
   * @returns {BasePrompt[]} Array of prompts in category
   */
  getByCategory(category) {
    const promptNames = this.categories.get(category);
    if (!promptNames) {
      return [];
    }

    return Array.from(promptNames)
      .map((name) => this.prompts.get(name))
      .filter(Boolean);
  }

  /**
   * Get all categories
   * @returns {string[]} Array of category names
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Get prompt metadata
   * @param {string} name - Prompt name
   * @returns {Object|null} Prompt metadata or null
   */
  getMetadata(name) {
    return this.metadata.get(name) || null;
  }

  /**
   * Get all prompts metadata
   * @returns {Object[]} Array of prompt metadata
   */
  getAllMetadata() {
    return Array.from(this.metadata.values());
  }

  /**
   * Execute a prompt
   * @param {string} name - Prompt name
   * @param {Object} args - Execution arguments
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   * @throws {HulyError} If prompt not found or execution fails
   */
  async execute(name, args = {}, context = {}) {
    const prompt = this.get(name);
    if (!prompt) {
      throw HulyError.notFound('prompt', name);
    }

    // Sanitize arguments
    const sanitizedArgs = PromptUtils.sanitizeArguments(args);

    // Add registry context
    const executionContext = {
      ...context,
      registry: this,
      promptMetadata: this.getMetadata(name),
    };

    try {
      const result = await prompt.execute(sanitizedArgs, executionContext);

      logger.debug(`Executed prompt: ${name}`, { args: sanitizedArgs });

      return result;
    } catch (_error) {
      logger.error(`Failed to execute prompt: ${name}`, error);
      throw error;
    }
  }

  /**
   * Get MCP-compatible prompt list
   * @returns {Object[]} Array of MCP prompt definitions
   */
  getMCPPromptList() {
    return Array.from(this.prompts.values()).map((prompt) => prompt.toMCPDefinition());
  }

  /**
   * Clear all registered prompts
   * @param {string} [category] - Optional category to clear (clears all if not specified)
   */
  clear(category = null) {
    if (category) {
      const promptNames = this.categories.get(category);
      if (promptNames) {
        for (const name of promptNames) {
          this.prompts.delete(name);
          this.metadata.delete(name);
        }
        this.categories.delete(category);
      }
    } else {
      this.prompts.clear();
      this.categories.clear();
      this.metadata.clear();
    }

    logger.debug(`Cleared prompts${category ? ` in category: ${category}` : ''}`);
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStatistics() {
    const totalPrompts = this.prompts.size;
    const categories = this.getCategories();
    const wizardCount = Array.from(this.prompts.values()).filter(
      (prompt) => prompt instanceof WizardPrompt
    ).length;

    return {
      totalPrompts,
      categories: categories.length,
      categoryBreakdown: Object.fromEntries(
        categories.map((cat) => [cat, this.categories.get(cat).size])
      ),
      wizardPrompts: wizardCount,
      regularPrompts: totalPrompts - wizardCount,
      initialized: this.initialized,
    };
  }

  /**
   * Load prompts from a directory
   * @param {string} directory - Directory path to load from
   * @param {string} [category='general'] - Default category for loaded prompts
   * @returns {Promise<number>} Number of prompts loaded
   */
  async loadFromDirectory(directory, category = 'general') {
    let loadedCount = 0;

    try {
      // Check if directory exists
      statSync(directory);
    } catch {
      logger.warn(`Prompt directory not found: ${directory}`);
      return 0;
    }

    try {
      const files = readdirSync(directory);

      for (const file of files) {
        // Skip non-JS files and test files
        if (!file.endsWith('.js') || file.includes('.test.') || file.includes('__tests__')) {
          continue;
        }

        const filePath = join(directory, file);

        try {
          // Dynamically import the prompt module
          const promptModule = await import(`file://${filePath}`);

          // Check for registerPrompts function
          if (promptModule.registerPrompts && typeof promptModule.registerPrompts === 'function') {
            await promptModule.registerPrompts(this);
            loadedCount++;
          } else {
            logger.warn(`Prompt file missing registerPrompts export: ${file}`);
          }
        } catch (_error) {
          logger.error(`Failed to load prompt from ${file}:`, error);
        }
      }
    } catch (_error) {
      logger.error(`Failed to read prompt directory ${directory}:`, error);
    }

    return loadedCount;
  }

  /**
   * Initialize the prompt registry with default prompts
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('Prompt registry already initialized');
      return;
    }

    logger.info('Initializing prompt registry...');

    const promptsDir = join(__dirname, '..', 'wizards');
    const loadedCount = await this.loadFromDirectory(promptsDir, 'wizards');

    this.initialized = true;

    logger.info(`Prompt registry initialized with ${loadedCount} prompts loaded`);
  }

  /**
   * Validate all registered prompts
   * @returns {Object} Validation results
   */
  validate() {
    const results = {
      valid: [],
      invalid: [],
      warnings: [],
    };

    for (const [name, prompt] of this.prompts.entries()) {
      try {
        // Basic validation
        prompt.validateDefinition({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
          handler: prompt.handler,
        });

        results.valid.push(name);

        // Check for potential issues
        if (prompt.arguments.length === 0) {
          results.warnings.push(`Prompt '${name}' has no arguments defined`);
        }

        if (prompt.description.length < 10) {
          results.warnings.push(`Prompt '${name}' has very short description`);
        }
      } catch (_error) {
        results.invalid.push({
          name,
          error: error.message,
        });
      }
    }

    return results;
  }
}

// Create and export singleton instance
export const promptRegistry = new PromptRegistry();

/**
 * Helper function to register a prompt
 * @param {PromptDefinition} definition - Prompt definition
 * @param {string} [category='general'] - Prompt category
 * @returns {BasePrompt} Created prompt instance
 */
export function registerPrompt(definition, category = 'general') {
  const prompt = new BasePrompt(definition);
  promptRegistry.register(prompt, category);
  return prompt;
}

/**
 * Helper function to register a wizard prompt
 * @param {PromptDefinition} definition - Wizard prompt definition
 * @param {string} [category='wizards'] - Prompt category
 * @returns {WizardPrompt} Created wizard prompt instance
 */
export function registerWizardPrompt(definition, category = 'wizards') {
  // Ensure wizard annotation is set
  const wizardDefinition = {
    ...definition,
    annotations: {
      wizard: true,
      ...definition.annotations,
    },
  };

  const prompt = new WizardPrompt(wizardDefinition);
  promptRegistry.register(prompt, category);
  return prompt;
}

export default promptRegistry;
