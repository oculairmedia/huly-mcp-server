/**
 * Validation Utilities
 * 
 * Centralized validation functions for the Huly MCP Server
 */

import { PRIORITY_MAP, VALID_UPDATE_FIELDS } from '../core/constants.js';
import { HulyError } from '../core/HulyError.js';

/**
 * Validate project identifier format
 * @param {string} identifier - Project identifier to validate
 * @returns {boolean} True if valid
 */
export function isValidProjectIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return false;
  }
  // Project identifiers should be 1-5 uppercase letters/numbers
  return /^[A-Z0-9]{1,5}$/.test(identifier);
}

/**
 * Validate issue identifier format
 * @param {string} identifier - Issue identifier to validate
 * @returns {boolean} True if valid
 */
export function isValidIssueIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return false;
  }
  // Issue identifiers should be PROJECT-NUMBER format
  return /^[A-Z0-9]{1,5}-\d+$/.test(identifier);
}

/**
 * Parse issue identifier into components
 * @param {string} identifier - Issue identifier to parse
 * @returns {{project: string, number: number}|null} Parsed components or null
 */
export function parseIssueIdentifier(identifier) {
  if (!isValidIssueIdentifier(identifier)) {
    return null;
  }
  
  const [project, numberStr] = identifier.split('-');
  return {
    project,
    number: parseInt(numberStr, 10)
  };
}

/**
 * Validate priority value
 * @param {string} priority - Priority to validate
 * @returns {boolean} True if valid
 */
export function isValidPriority(priority) {
  if (!priority || typeof priority !== 'string') {
    return false;
  }
  return Object.keys(PRIORITY_MAP).includes(priority);
}

/**
 * Get valid priority values
 * @returns {string[]} Array of valid priority values
 */
export function getValidPriorities() {
  return Object.keys(PRIORITY_MAP);
}

/**
 * Normalize priority value (handle case variations)
 * @param {string} priority - Priority to normalize
 * @returns {string|null} Normalized priority or null if invalid
 */
export function normalizePriority(priority) {
  if (!priority || typeof priority !== 'string') {
    return null;
  }
  
  const normalized = priority.toLowerCase();
  const priorityMap = {
    'low': 'low',
    'medium': 'medium',
    'high': 'high',
    'urgent': 'urgent',
    'nopriority': 'NoPriority',
    'no-priority': 'NoPriority',
    'none': 'NoPriority'
  };
  
  return priorityMap[normalized] || null;
}

/**
 * Validate update field name
 * @param {string} field - Field name to validate
 * @returns {boolean} True if valid
 */
export function isValidUpdateField(field) {
  if (!field || typeof field !== 'string') {
    return false;
  }
  return VALID_UPDATE_FIELDS.includes(field);
}

/**
 * Validate date format (ISO 8601)
 * @param {string} date - Date string to validate
 * @returns {boolean} True if valid ISO 8601 date
 */
export function isValidISODate(date) {
  if (!date || typeof date !== 'string') {
    return false;
  }
  
  const parsed = Date.parse(date);
  if (isNaN(parsed)) {
    return false;
  }
  
  // Check if the parsed date converts back to the same ISO string
  const isoString = new Date(parsed).toISOString();
  return date === isoString || date === isoString.split('T')[0]; // Allow date-only format
}

/**
 * Validate milestone status
 * @param {string} status - Milestone status to validate
 * @returns {boolean} True if valid
 */
export function isValidMilestoneStatus(status) {
  const validStatuses = ['planned', 'in_progress', 'completed', 'canceled'];
  return validStatuses.includes(status);
}

/**
 * Validate required string field
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @param {Object} options - Validation options
 * @param {number} [options.minLength] - Minimum length
 * @param {number} [options.maxLength] - Maximum length
 * @param {RegExp} [options.pattern] - Pattern to match
 * @returns {string} Validated and trimmed string
 * @throws {HulyError} If validation fails
 */
export function validateRequiredString(value, fieldName, options = {}) {
  if (!value || typeof value !== 'string') {
    throw new HulyError(
      'MISSING_REQUIRED_FIELD',
      `${fieldName} is required`,
      {
        context: `Field '${fieldName}' must be provided`,
        data: { fieldName }
      }
    );
  }
  
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HulyError(
      'MISSING_REQUIRED_FIELD',
      `${fieldName} cannot be empty`,
      {
        context: `Field '${fieldName}' must not be empty`,
        data: { fieldName }
      }
    );
  }
  
  if (options.minLength && trimmed.length < options.minLength) {
    throw HulyError.validation(
      fieldName, 
      value, 
      `Must be at least ${options.minLength} characters`
    );
  }
  
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw HulyError.validation(
      fieldName, 
      value, 
      `Must be at most ${options.maxLength} characters`
    );
  }
  
  if (options.pattern && !options.pattern.test(trimmed)) {
    throw HulyError.validation(
      fieldName, 
      value, 
      `Invalid format`
    );
  }
  
  return trimmed;
}

/**
 * Validate optional string field
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @param {Object} options - Validation options (same as validateRequiredString)
 * @returns {string|undefined} Validated string or undefined if not provided
 * @throws {HulyError} If validation fails
 */
export function validateOptionalString(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  
  return validateRequiredString(value, fieldName, options);
}

/**
 * Validate enum value
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @param {string[]} validValues - Array of valid values
 * @param {string} [defaultValue] - Default value if not provided
 * @returns {string} Validated value
 * @throws {HulyError} If validation fails
 */
export function validateEnum(value, fieldName, validValues, defaultValue) {
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new HulyError(
      'MISSING_REQUIRED_FIELD',
      `${fieldName} is required`,
      {
        context: `Field '${fieldName}' must be provided`,
        data: { fieldName }
      }
    );
  }
  
  if (!validValues.includes(value)) {
    throw HulyError.invalidValue(fieldName, value, validValues.join(', '));
  }
  
  return value;
}

/**
 * Validate positive integer
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @param {Object} options - Validation options
 * @param {number} [options.min] - Minimum value
 * @param {number} [options.max] - Maximum value
 * @param {number} [options.defaultValue] - Default value if not provided
 * @returns {number} Validated integer
 * @throws {HulyError} If validation fails
 */
export function validatePositiveInteger(value, fieldName, options = {}) {
  if (value === undefined || value === null) {
    if (options.defaultValue !== undefined) {
      return options.defaultValue;
    }
    throw new HulyError(
      'MISSING_REQUIRED_FIELD',
      `${fieldName} is required`,
      {
        context: `Field '${fieldName}' must be provided`,
        data: { fieldName }
      }
    );
  }
  
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw HulyError.validation(fieldName, value, 'Must be a positive integer');
  }
  
  if (options.min !== undefined && num < options.min) {
    throw HulyError.validation(fieldName, value, `Must be at least ${options.min}`);
  }
  
  if (options.max !== undefined && num > options.max) {
    throw HulyError.validation(fieldName, value, `Must be at most ${options.max}`);
  }
  
  return num;
}

/**
 * Sanitize string input to prevent injection
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove control characters and trim
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Create a validator function for a specific entity type
 * @param {Object} config - Validator configuration
 * @param {Function} config.identifier - Identifier validation function
 * @param {string} config.entityName - Entity name for error messages
 * @returns {Function} Validator function
 */
export function createIdentifierValidator(config) {
  return function(identifier) {
    if (!identifier) {
      throw new HulyError(
        'MISSING_REQUIRED_FIELD',
        `${config.entityName} identifier is required`,
        {
          context: `${config.entityName} identifier must be provided`,
          data: { entityName: config.entityName }
        }
      );
    }
    
    if (!config.validator(identifier)) {
      throw HulyError.validation(
        `${config.entityName} identifier`,
        identifier,
        `Invalid ${config.entityName} identifier format`
      );
    }
    
    return identifier;
  };
}

// Pre-configured validators
export const validateProjectIdentifier = createIdentifierValidator({
  validator: isValidProjectIdentifier,
  entityName: 'project'
});

export const validateIssueIdentifier = createIdentifierValidator({
  validator: isValidIssueIdentifier,
  entityName: 'issue'
});