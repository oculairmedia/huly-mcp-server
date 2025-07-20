/**
 * Create Project Tool
 *
 * Creates a new project in the Huly workspace
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_project',
  description: 'Create a new project',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Project name',
      },
      description: {
        type: 'string',
        description: 'Project description',
      },
      identifier: {
        type: 'string',
        description: 'Project identifier (max 5 chars, uppercase)',
      },
    },
    required: ['name'],
  },
  annotations: {
    title: 'Create Project',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
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
    logger.debug('Creating new project', args);

    const result = await projectService.createProject(
      client,
      args.name,
      args.description,
      args.identifier
    );

    return result;
  } catch (error) {
    logger.error('Failed to create project:', error);
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

  // Validate name
  if (!args.name || args.name.trim().length === 0) {
    errors.name = 'Project name is required';
  }

  // Validate identifier if provided
  if (args.identifier) {
    if (args.identifier.length > 5) {
      errors.identifier = 'Project identifier must be 5 characters or less';
    }
    if (args.identifier !== args.identifier.toUpperCase()) {
      errors.identifier = 'Project identifier must be uppercase';
    }
    if (!/^[A-Z0-9]+$/.test(args.identifier)) {
      errors.identifier = 'Project identifier must contain only uppercase letters and numbers';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
