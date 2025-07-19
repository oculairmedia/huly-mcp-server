/**
 * Core constants for Huly MCP Server
 *
 * Contains error codes, configuration constants, and other shared values
 */

// Error codes for structured error responses
export const ERROR_CODES = {
  // Resource not found errors
  ISSUE_NOT_FOUND: 'ISSUE_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  COMPONENT_NOT_FOUND: 'COMPONENT_NOT_FOUND',
  MILESTONE_NOT_FOUND: 'MILESTONE_NOT_FOUND',
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  REPOSITORY_NOT_FOUND: 'REPOSITORY_NOT_FOUND',

  // Validation errors
  INVALID_FIELD: 'INVALID_FIELD',
  INVALID_VALUE: 'INVALID_VALUE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Database and connection errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // Permission and authentication errors
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  UNAUTHORIZED_ERROR: 'UNAUTHORIZED_ERROR',

  // Operation errors
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// Priority mappings
export const PRIORITY_MAP = {
  'NoPriority': 0,
  'urgent': 1,
  'high': 2,
  'medium': 3,
  'low': 4
};

export const PRIORITY_NAMES = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'];

// Milestone status mappings
export const MILESTONE_STATUS_MAP = {
  'planned': 0,
  'in_progress': 1,
  'completed': 2,
  'canceled': 3
};

export const MILESTONE_STATUS_NAMES = ['Planned', 'In Progress', 'Completed', 'Canceled'];

// Default values
export const DEFAULTS = {
  ISSUE_LIMIT: 50,
  COMMENT_LIMIT: 50,
  SEARCH_LIMIT: 50,
  DESCRIPTION_TRUNCATE_LENGTH: 200,
  DEFAULT_PRIORITY: 'medium',
  DEFAULT_MILESTONE_STATUS: 'planned'
};

// Validation patterns
export const VALIDATION_PATTERNS = {
  PROJECT_IDENTIFIER: /^[A-Z]{1,5}$/,
  ISSUE_IDENTIFIER: /^([A-Z]+)-(\d+)$/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/
};

// Field names for validation
export const VALID_UPDATE_FIELDS = ['title', 'description', 'status', 'priority', 'component', 'milestone'];

// MCP protocol constants
export const MCP_PROTOCOL = {
  VERSION: '2024-11-05',
  JSON_RPC_VERSION: '2.0'
};

// Server info
export const SERVER_INFO = {
  name: 'huly-mcp-server',
  version: '1.0.0',
  description: 'MCP server for Huly project management platform'
};