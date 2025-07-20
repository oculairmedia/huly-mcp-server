/**
 * Update Issue Tool
 * 
 * Updates an existing issue
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_update_issue',
  description: 'Update an existing issue',
  inputSchema: {
    type: 'object',
    properties: {
      issue_identifier: {
        type: 'string',
        description: 'Issue identifier (e.g., "LMP-1")'
      },
      field: {
        type: 'string',
        description: 'Field to update',
        enum: ['title', 'description', 'status', 'priority', 'component', 'milestone']
      },
      value: {
        type: 'string',
        description: 'New value for the field. For status: accepts human-readable (backlog, todo, in-progress, done, canceled) or full format (tracker:status:Backlog, etc.)'
      }
    },
    required: ['issue_identifier', 'field', 'value']
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
    logger.debug('Updating issue', args);
    
    const result = await issueService.updateIssue(
      client,
      args.issue_identifier,
      args.field,
      args.value
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to update issue:', error);
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
  
  // Validate field
  const validFields = ['title', 'description', 'status', 'priority', 'component', 'milestone'];
  if (!args.field || !validFields.includes(args.field)) {
    errors.field = `Field must be one of: ${validFields.join(', ')}`;
  }
  
  // Validate value
  if (args.value === undefined || args.value === null || args.value.toString().trim().length === 0) {
    errors.value = 'Value is required';
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}