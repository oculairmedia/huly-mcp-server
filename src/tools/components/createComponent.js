/**
 * Create Component Tool
 * 
 * Creates a new component in a project
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_component',
  description: 'Create a new component in a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "WEBHOOK")'
      },
      label: {
        type: 'string',
        description: 'Component name'
      },
      description: {
        type: 'string',
        description: 'Component description'
      }
    },
    required: ['project_identifier', 'label']
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
    logger.debug('Creating new component', args);
    
    const result = await projectService.createComponent(
      client,
      args.project_identifier,
      args.label,
      args.description
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to create component:', error);
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
  
  // Validate label
  if (!args.label || args.label.trim().length === 0) {
    errors.label = 'Component label is required';
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}