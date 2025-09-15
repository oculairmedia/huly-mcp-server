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
  description:
    'Establish a new project within the Huly workspace, initializing a complete project structure with customizable metadata, unique identification, and foundational organizational elements. This tool creates the fundamental container for all project-related activities including issues, milestones, components, and team collaboration. The project creation process automatically generates essential project infrastructure such as default issue statuses, priority levels, and workflow configurations while allowing for custom project identifiers (up to 5 uppercase characters) that serve as prefixes for all project-related entities. The tool supports rich project descriptions with markdown formatting, enabling detailed project documentation and stakeholder communication. Upon successful creation, the new project becomes immediately available for issue creation, team assignment, milestone planning, and integration with external systems like GitHub repositories, making it the essential starting point for any new development initiative or organizational workflow within the Huly ecosystem.',
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
