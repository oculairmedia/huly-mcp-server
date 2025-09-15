/**
 * Prompt Interface and Base Classes
 * Provides base interfaces and validation for MCP prompt system
 */

import { HulyError } from '../../core/HulyError.js';

/**
 * Prompt argument definition
 * @typedef {Object} PromptArgument
 * @property {string} name - Argument name
 * @property {string} description - Human-readable description
 * @property {boolean} [required] - Whether argument is required
 */

/**
 * Prompt definition interface
 * @typedef {Object} PromptDefinition
 * @property {string} name - Unique prompt name
 * @property {string} description - Human-readable description
 * @property {PromptArgument[]} [arguments] - Available arguments
 * @property {Function} handler - Prompt execution handler
 * @property {Object} [annotations] - Additional metadata
 */

/**
 * Base Prompt class that all prompts should extend
 */
export class BasePrompt {
  /**
   * Create a new prompt
   * @param {PromptDefinition} definition - Prompt definition
   */
  constructor(definition) {
    this.validateDefinition(definition);

    this.name = definition.name;
    this.description = definition.description;
    this.arguments = definition.arguments || [];
    this.handler = definition.handler;
    this.annotations = definition.annotations || {};
  }

  /**
   * Validate prompt definition
   * @param {PromptDefinition} definition - Definition to validate
   * @throws {HulyError} If definition is invalid
   */
  validateDefinition(definition) {
    if (!definition || typeof definition !== 'object') {
      throw HulyError.invalidValue('definition', definition, 'valid prompt definition object');
    }

    if (!definition.name || typeof definition.name !== 'string') {
      throw HulyError.invalidValue('name', definition.name, 'non-empty string');
    }

    if (!definition.description || typeof definition.description !== 'string') {
      throw HulyError.invalidValue('description', definition.description, 'non-empty string');
    }

    if (!definition.handler || typeof definition.handler !== 'function') {
      throw HulyError.invalidValue('handler', definition.handler, 'function');
    }

    if (definition.arguments && !Array.isArray(definition.arguments)) {
      throw HulyError.invalidValue('arguments', definition.arguments, 'array');
    }

    // Validate arguments if provided
    if (definition.arguments) {
      for (const arg of definition.arguments) {
        this.validateArgument(arg);
      }
    }
  }

  /**
   * Validate prompt argument definition
   * @param {PromptArgument} argument - Argument to validate
   * @throws {HulyError} If argument is invalid
   */
  validateArgument(argument) {
    if (!argument || typeof argument !== 'object') {
      throw HulyError.invalidValue('argument', argument, 'valid argument object');
    }

    if (!argument.name || typeof argument.name !== 'string') {
      throw HulyError.invalidValue('argument.name', argument.name, 'non-empty string');
    }

    if (!argument.description || typeof argument.description !== 'string') {
      throw HulyError.invalidValue('argument.description', argument.description, 'non-empty string');
    }

    if (argument.required !== undefined && typeof argument.required !== 'boolean') {
      throw HulyError.invalidValue('argument.required', argument.required, 'boolean');
    }
  }

  /**
   * Validate arguments provided to prompt execution
   * @param {Object} providedArgs - Arguments provided for execution
   * @throws {HulyError} If required arguments are missing
   */
  validateExecutionArguments(providedArgs = {}) {
    const requiredArgs = this.arguments.filter(arg => arg.required);
    const missingArgs = requiredArgs.filter(arg => !(arg.name in providedArgs));

    if (missingArgs.length > 0) {
      const missing = missingArgs.map(arg => arg.name);
      throw HulyError.invalidValue(
        'arguments',
        providedArgs,
        `Required arguments missing: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Execute the prompt with provided arguments
   * @param {Object} args - Arguments for execution
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(args, context) {
    // Validate arguments
    this.validateExecutionArguments(args);

    // Execute the handler
    try {
      const result = await this.handler(args, context);

      // Ensure result has proper format
      if (!result || typeof result !== 'object') {
        throw new Error('Prompt handler must return an object');
      }

      return result;
    } catch (error) {
      if (error instanceof HulyError) {
        throw error;
      }

      throw new HulyError('PROMPT_EXECUTION_FAILED', `Failed to execute prompt ${this.name}`, {
        context: error.message,
        data: { promptName: this.name, args }
      });
    }
  }

  /**
   * Get MCP-compatible prompt definition
   * @returns {Object} MCP prompt definition
   */
  toMCPDefinition() {
    return {
      name: this.name,
      description: this.description,
      arguments: this.arguments.map(arg => ({
        name: arg.name,
        description: arg.description,
        required: arg.required || false
      }))
    };
  }

  /**
   * Get prompt metadata
   * @returns {Object} Prompt metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      argumentCount: this.arguments.length,
      requiredArguments: this.arguments.filter(arg => arg.required).length,
      annotations: this.annotations
    };
  }
}

/**
 * Wizard Prompt class for multi-step interactions
 */
export class WizardPrompt extends BasePrompt {
  /**
   * Create a new wizard prompt
   * @param {PromptDefinition} definition - Prompt definition
   */
  constructor(definition) {
    super(definition);

    // Validate wizard-specific properties
    if (!this.annotations.wizard) {
      throw HulyError.invalidValue('annotations.wizard', this.annotations.wizard, 'true for wizard prompts');
    }

    this.maxSteps = this.annotations.maxSteps || 10;
    this.sessionTimeout = this.annotations.sessionTimeout || 3600; // 1 hour
  }

  /**
   * Execute wizard step
   * @param {Object} args - Arguments for execution
   * @param {Object} context - Execution context (includes wizardState)
   * @returns {Promise<Object>} Step execution result
   */
  async execute(args, context) {
    // Ensure wizard state is available
    if (!context.wizardState) {
      throw new HulyError('WIZARD_STATE_MISSING', 'Wizard state not available in context');
    }

    // Validate step count
    if (context.wizardState.currentStep >= this.maxSteps) {
      throw new HulyError('WIZARD_MAX_STEPS_EXCEEDED', `Wizard has exceeded maximum steps (${this.maxSteps})`);
    }

    return super.execute(args, context);
  }

  /**
   * Get wizard-specific metadata
   * @returns {Object} Wizard metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      type: 'wizard',
      maxSteps: this.maxSteps,
      sessionTimeout: this.sessionTimeout
    };
  }
}

/**
 * Utility functions for prompt validation
 */
export const PromptUtils = {
  /**
   * Validate prompt name format
   * @param {string} name - Prompt name to validate
   * @returns {boolean} Whether name is valid
   */
  isValidPromptName(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // Prompt names should be kebab-case alphanumeric (no consecutive dashes, no trailing/leading dashes)
    return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
  },

  /**
   * Sanitize prompt arguments
   * @param {Object} args - Arguments to sanitize
   * @returns {Object} Sanitized arguments
   */
  sanitizeArguments(args) {
    if (!args || typeof args !== 'object') {
      return {};
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(args)) {
      // Remove null/undefined values
      if (value != null) {
        // Convert strings to trimmed versions
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            sanitized[key] = trimmed;
          }
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  },

  /**
   * Create standardized prompt response
   * @param {string} content - Response content
   * @param {Object} [data] - Additional response data
   * @returns {Object} Standardized response
   */
  createResponse(content, data = {}) {
    return {
      content: [
        {
          type: 'text',
          text: content
        }
      ],
      data: {
        timestamp: new Date().toISOString(),
        ...data
      }
    };
  },

  /**
   * Create error response
   * @param {string} message - Error message
   * @param {Object} [data] - Additional error data
   * @returns {Object} Error response
   */
  createErrorResponse(message, data = {}) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${message}`
        }
      ],
      data: {
        timestamp: new Date().toISOString(),
        error: true,
        message,
        ...data
      }
    };
  },

  /**
   * Create success response
   * @param {string} title - Success title
   * @param {string|Object} content - Success content or data
   * @returns {Object} Success response
   */
  createSuccessResponse(title, content) {
    if (typeof content === 'object' && content !== null) {
      // If content is an object with structured data
      return {
        content: [
          {
            type: 'text',
            text: `✅ ${title}`
          }
        ],
        data: {
          timestamp: new Date().toISOString(),
          success: true,
          ...content
        }
      };
    }

    // If content is a string
    return {
      content: [
        {
          type: 'text',
          text: `✅ ${title}\n\n${content || ''}`
        }
      ],
      data: {
        timestamp: new Date().toISOString(),
        success: true
      }
    };
  }
};