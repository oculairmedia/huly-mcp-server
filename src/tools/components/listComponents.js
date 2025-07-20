/**
 * List Components Tool
 * 
 * Lists all components in a project
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_components',
  description: 'List all components in a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "WEBHOOK")'
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
  const { projectService } = services;
  
  try {
    logger.debug('Listing components for project', args);
    
    const result = await projectService.listComponents(
      client,
      args.project_identifier
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to list components:', error);
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
  
  // Validate project identifier
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}