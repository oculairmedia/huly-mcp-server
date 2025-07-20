/**
 * Assign Repository to Project Tool
 * 
 * Assigns a GitHub repository to a Huly project
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_assign_repository_to_project',
  description: 'Assign a GitHub repository to a Huly project',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "WEBHOOK")'
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (e.g., "my-org/my-repo")'
      }
    },
    required: ['project_identifier', 'repository_name']
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
    logger.debug('Assigning repository to project', args);
    
    const result = await projectService.assignRepositoryToProject(
      client,
      args.project_identifier,
      args.repository_name
    );
    
    return result;
  } catch (error) {
    logger.error('Failed to assign repository to project:', error);
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
  
  // Validate repository name
  if (!args.repository_name || args.repository_name.trim().length === 0) {
    errors.repository_name = 'Repository name is required';
  } else {
    // Validate repository name format (org/repo or owner/repo)
    const repoRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
    if (!repoRegex.test(args.repository_name)) {
      errors.repository_name = 'Repository name must be in format "owner/repo" or "org/repo"';
    }
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}