/**
 * Assign Repository to Project Tool
 *
 * Assigns a GitHub repository to a Huly project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_assign_repository_to_project',
  description: 'Establish bidirectional integration between GitHub repositories and Huly projects, enabling seamless development workflow coordination, automated issue synchronization, and comprehensive project-repository relationship management for enhanced development productivity and project tracking. This critical integration tool creates persistent connections between external GitHub repositories and internal Huly projects, facilitating automatic cross-platform data synchronization, webhook-based event handling, and unified project management across development and project management platforms. The assignment process includes thorough validation of project existence, repository accessibility, integration permissions, and connection health, followed by atomic relationship establishment that ensures reliable integration and consistent data flow. Advanced features include automatic webhook configuration for real-time synchronization, comprehensive permission validation for secure repository access, detailed integration status monitoring with health checks, and seamless integration with existing project workflows and issue management processes. The tool supports complex organizational scenarios requiring multi-repository project management, cross-platform workflow coordination, and integrated development lifecycle management while maintaining security, reliability, and audit compliance. This tool is essential for DevOps integration, development workflow optimization, project-repository governance, and organizational scenarios requiring reliable, secure, and auditable repository-project relationship management with full consideration for complex development dependencies and cross-platform workflow coordination across diverse project types and development methodologies.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "WEBHOOK")',
      },
      repository_name: {
        type: 'string',
        description: 'GitHub repository name (e.g., "my-org/my-repo")',
      },
    },
    required: ['project_identifier', 'repository_name'],
  },
  annotations: {
    title: 'Assign GitHub Repository',
    readOnlyHint: false, // Modifies project configuration
    destructiveHint: false, // Does not delete any data
    idempotentHint: true, // Assigning same repo multiple times has same effect
    openWorldHint: true, // Interacts with external Huly/GitHub systems
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
    const repoRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
    if (!repoRegex.test(args.repository_name)) {
      errors.repository_name = 'Repository name must be in format "owner/repo" or "org/repo"';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
