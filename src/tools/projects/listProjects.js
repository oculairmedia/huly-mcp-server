/**
 * List Projects Tool
 * 
 * Lists all projects in the Huly workspace
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_projects',
  description: 'List all projects in Huly workspace',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments (empty for this tool)
 * @param {import('../base/ToolInterface').ToolContext} context - Execution context
 * @returns {Promise<import('../base/ToolInterface').ToolResponse>}
 */
export async function handler(args, context) {
  const { client, services, logger } = context;
  const { projectService } = services;
  
  try {
    logger.debug('Listing all projects');
    
    const projects = await projectService.getAllProjects(client);
    
    if (!projects || projects.length === 0) {
      return createToolResponse('No projects found in workspace');
    }

    // Format project list
    const projectList = projects
      .map(project => {
        const description = project.description ? ` - ${project.description}` : '';
        return `- ${project.name} (${project.identifier})${description}`;
      })
      .join('\n');

    return createToolResponse(`Found ${projects.length} projects:\n${projectList}`);
  } catch (error) {
    logger.error('Failed to list projects:', error);
    return createErrorResponse(error);
  }
}

/**
 * Optional validation function
 * @param {Object} args - Tool arguments
 * @returns {Object|null} Validation errors or null
 */
export function validate(args) {
  // No validation needed for this tool
  return null;
}