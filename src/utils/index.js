/**
 * Utils module exports
 *
 * Central export point for utility functions
 */

export {
  extractTextFromMarkup,
  extractTextFromDoc,
  extractTextAdvanced,
  extractTextFromJSON,
  extractText,
  truncateText,
  cleanText
} from './textExtractor.js';

export {
  isValidProjectIdentifier,
  isValidIssueIdentifier,
  parseIssueIdentifier,
  isValidPriority,
  getValidPriorities,
  normalizePriority,
  isValidUpdateField,
  isValidISODate,
  isValidMilestoneStatus,
  validateRequiredString,
  validateOptionalString,
  validateEnum,
  validatePositiveInteger,
  sanitizeString,
  createIdentifierValidator,
  validateProjectIdentifier,
  validateIssueIdentifier
} from './validators.js';

export {
  Logger,
  getLogger,
  createLoggerWithConfig,
  resetLogger
} from './Logger.js';