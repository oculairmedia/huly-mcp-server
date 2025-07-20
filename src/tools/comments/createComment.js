/**
 * Create Comment Tool
 * 
 * Create a comment on an issue
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_comment',
  description: 'Create a comment on an issue',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "LMP-1")'
      },
      message: {
        type: 'string',
        description: 'Comment message (supports markdown)'
      }
    },
    required: ['issue_identifier', 'message']
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
    logger.debug('Creating comment', args);
    
    const result = await issueService.createComment(
      client,
      args.issue_identifier,
      args.message
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to create comment:', error);
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
  
  // Validate message
  if (!args.message || args.message.trim().length === 0) {
    errors.message = 'Comment message is required';
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}