/**
 * List Issues Tool
 * 
 * Lists issues in a specific project
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_issues',
  description: 'List issues in a specific project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "LMP")'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50)',
        default: 50
      }
    },
    required: ['project_identifier']
  }
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {import('../base/ToolInterface').ToolContext} context - Execution context
 * @returns {Promise<import('../base/ToolInterface').ToolResponse>}
 */
export async function handler(args, context) {
  const { client, services, logger } = context;
  const { issueService } = services;
  
  try {
    logger.debug('Listing issues', args);
    
    const result = await issueService.listIssues(
      client,
      args.project_identifier,
      args.limit
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to list issues:', error);
    return createErrorResponse(error);
  }
}

/**
 * Optional validation function
 * @param {Object} args - Tool arguments
 * @returns {Object|null} Validation errors or null
 */
export function validate(args) {
  const errors = {};
  
  // Validate project_identifier
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  }
  
  // Validate limit if provided
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}