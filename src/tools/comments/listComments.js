/**
 * List Comments Tool
 * 
 * List comments on an issue
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_comments',
  description: 'List comments on an issue',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "LMP-1")'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of comments to return (default: 50)',
        default: 50
      }
    },
    required: ['issue_identifier']
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
    logger.debug('Listing comments', args);
    
    const result = await issueService.listComments(
      client,
      args.issue_identifier,
      args.limit
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to list comments:', error);
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
  
  // Validate issue_identifier
  if (!args.issue_identifier || args.issue_identifier.trim().length === 0) {
    errors.issue_identifier = 'Issue identifier is required';
  }
  
  // Validate limit if provided
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}