/**
 * HulyError - Custom error class for Huly MCP Server
 *
 * Provides structured error handling with consistent formatting
 * and MCP-compatible response generation
 */

import { ERROR_CODES } from './constants.js';

/**
 * Custom error class for Huly MCP Server
 * Extends Error to provide additional context and formatting
 */
export class HulyError extends Error {
  /**
   * Create a HulyError instance
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {Object} details - Additional error details
   * @param {string} [details.context] - Context about when/where the error occurred
   * @param {string} [details.suggestion] - Suggestion for resolving the error
   * @param {*} [details.data] - Any additional data relevant to the error
   */
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details || {};
    this.name = 'HulyError';

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HulyError);
    }
  }

  /**
   * Convert error to MCP-compatible response format
   * @returns {Object} MCP response object
   */
  toMCPResponse() {
    return {
      content: [
        {
          type: 'text',
          text: this.formatErrorMessage(),
        },
      ],
    };
  }

  /**
   * Format error message with details
   * @returns {string} Formatted error message
   */
  formatErrorMessage() {
    let text = `❌ Error [${this.code}]: ${this.message}`;

    if (this.details?.context) {
      text += `\n\nContext: ${this.details.context}`;
    }

    if (this.details?.suggestion) {
      text += `\n\nSuggestion: ${this.details.suggestion}`;
    }

    return text;
  }

  /**
   * Convert to JSON for serialization
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }

  /**
   * Check if error is of a specific type
   * @param {string} code - Error code to check
   * @returns {boolean} True if error matches code
   */
  isType(code) {
    return this.code === code;
  }

  /**
   * Create a validation error
   * @param {string} field - Field that failed validation
   * @param {*} value - Invalid value
   * @param {string} [suggestion] - Suggestion for valid values
   * @returns {HulyError} Validation error instance
   */
  static validation(field, value, suggestion) {
    return new HulyError(ERROR_CODES.VALIDATION_ERROR, `Validation failed for field '${field}'`, {
      context: `Invalid value: ${JSON.stringify(value)}`,
      suggestion: suggestion || 'Please provide a valid value',
      data: { field, value },
    });
  }

  /**
   * Create a not found error
   * @param {string} resourceType - Type of resource (e.g., 'issue', 'project')
   * @param {string} identifier - Resource identifier
   * @returns {HulyError} Not found error instance
   */
  static notFound(resourceType, identifier) {
    const codeMap = {
      issue: ERROR_CODES.ISSUE_NOT_FOUND,
      project: ERROR_CODES.PROJECT_NOT_FOUND,
      component: ERROR_CODES.COMPONENT_NOT_FOUND,
      milestone: ERROR_CODES.MILESTONE_NOT_FOUND,
      comment: ERROR_CODES.COMMENT_NOT_FOUND,
      repository: ERROR_CODES.REPOSITORY_NOT_FOUND,
    };

    const code = codeMap[resourceType.toLowerCase()] || ERROR_CODES.UNKNOWN_ERROR;

    return new HulyError(code, `${resourceType} ${identifier} not found`, {
      context: `No ${resourceType.toLowerCase()} found with identifier ${identifier}`,
      suggestion: `Check the ${resourceType.toLowerCase()} identifier and ensure it exists`,
      data: { resourceType, identifier },
    });
  }

  /**
   * Create a database error
   * @param {string} operation - Database operation that failed
   * @param {Error} originalError - Original database error
   * @returns {HulyError} Database error instance
   */
  static database(operation, originalError) {
    return new HulyError(ERROR_CODES.DATABASE_ERROR, `Database operation failed: ${operation}`, {
      context: originalError.message,
      suggestion: 'Check database connection and try again',
      data: { operation, originalError: originalError.message },
    });
  }

  /**
   * Create a connection error
   * @param {string} service - Service that failed to connect
   * @param {Error} originalError - Original connection error
   * @returns {HulyError} Connection error instance
   */
  static connection(service, originalError) {
    return new HulyError(ERROR_CODES.CONNECTION_ERROR, `Failed to connect to ${service}`, {
      context: originalError.message,
      suggestion: 'Check network connection and service availability',
      data: { service, originalError: originalError.message },
    });
  }

  /**
   * Create a permission error
   * @param {string} action - Action that was denied
   * @param {string} resource - Resource being accessed
   * @returns {HulyError} Permission error instance
   */
  static permission(action, resource) {
    return new HulyError(ERROR_CODES.PERMISSION_ERROR, `Permission denied for ${action}`, {
      context: `User does not have permission to ${action} ${resource}`,
      suggestion: 'Check user permissions and access rights',
      data: { action, resource },
    });
  }

  /**
   * Create an invalid field error
   * @param {string} field - Invalid field name
   * @param {string[]} validFields - List of valid field names
   * @returns {HulyError} Invalid field error instance
   */
  static invalidField(field, validFields) {
    return new HulyError(ERROR_CODES.INVALID_FIELD, `Invalid field name: ${field}`, {
      context: `Field '${field}' is not a valid field`,
      suggestion: `Use one of: ${validFields.join(', ')}`,
      data: { field, validFields },
    });
  }

  /**
   * Create an invalid value error
   * @param {string} field - Field with invalid value
   * @param {*} value - Invalid value
   * @param {string} expectedType - Expected value type/format
   * @returns {HulyError} Invalid value error instance
   */
  static invalidValue(field, value, expectedType) {
    return new HulyError(ERROR_CODES.INVALID_VALUE, `Invalid value for field '${field}'`, {
      context: `Value '${value}' is not valid for field '${field}'`,
      suggestion: `Expected ${expectedType}`,
      data: { field, value, expectedType },
    });
  }
}

// Re-export ERROR_CODES for convenience
export { ERROR_CODES };
