/**
 * Create Subissue Tool
 * 
 * Creates a subissue under an existing parent issue
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_subissue',
  description: 'Create a subissue under an existing parent issue',
  inputSchema: {
    type: 'object',
    properties: {
      parent_issue_identifier: {
        type: 'string',
        description: 'Parent issue identifier (e.g., "LMP-1")'
      },
      title: {
        type: 'string',
        description: 'Subissue title'
      },
      description: {
        type: 'string',
        description: 'Subissue description'
      },
      priority: {
        type: 'string',
        description: 'Issue priority (low, medium, high, urgent)',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
      }
    },
    required: ['parent_issue_identifier', 'title']
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
    logger.debug('Creating subissue', args);
    
    const result = await issueService.createSubissue(
      client,
      args.parent_issue_identifier,
      args.title,
      args.description,
      args.priority
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to create subissue:', error);
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
  
  // Validate parent_issue_identifier
  if (!args.parent_issue_identifier || args.parent_issue_identifier.trim().length === 0) {
    errors.parent_issue_identifier = 'Parent issue identifier is required';
  }
  
  // Validate title
  if (!args.title || args.title.trim().length === 0) {
    errors.title = 'Subissue title is required';
  }
  
  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (args.priority && !validPriorities.includes(args.priority)) {
    errors.priority = `Priority must be one of: ${validPriorities.join(', ')}`;
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}