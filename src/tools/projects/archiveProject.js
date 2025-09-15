/**
 * Archive Project Tool
 *
 * Archives a project (soft delete) preserving all data
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { isValidProjectIdentifier } from '../../utils/validators.js';
import { HulyError } from '../../core/HulyError.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_archive_project',
  description:
    'Safely archive a project using soft deletion methodology, preserving all project data, historical records, and associated entities while removing the project from active workspace views and standard operational interfaces. This non-destructive approach maintains complete data integrity and audit trails, allowing for potential project restoration while immediately decluttering active workspace displays and preventing accidental modifications to completed or discontinued projects. The archival process maintains all relationships between issues, components, milestones, templates, and external integrations, ensuring that historical reporting, analytics, and compliance requirements remain fully satisfied. Unlike permanent deletion, archived projects can be restored through administrative interfaces, making this tool ideal for project lifecycle management, seasonal project handling, and organizational restructuring scenarios where data preservation is critical. The tool automatically updates project status indicators, removes the project from active listings and search results, and notifies relevant stakeholders while maintaining full access to archived data through specialized administrative views and reporting interfaces.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier to archive (e.g., "PROJ")',
      },
    },
    required: ['project_identifier'],
  },
};

/**
 * Tool handler
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Tool response
 */
export async function handler(args, context) {
  const { project_identifier } = args;
  const { client, services, logger } = context;
  const { deletionService } = services;

  try {
    logger.debug('Archiving project', args);

    // Validate project identifier
    if (!isValidProjectIdentifier(project_identifier)) {
      throw HulyError.invalidValue(
        'project_identifier',
        project_identifier,
        'format like "PROJ" (1-5 uppercase letters)'
      );
    }

    // Use DeletionService to handle the archiving
    const result = await deletionService.archiveProject(client, project_identifier);

    return {
      content: [
        {
          type: 'text',
          text: result.content[0].text,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to archive project:', error);
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

  // Validate project_identifier
  if (!args.project_identifier || args.project_identifier.trim().length === 0) {
    errors.project_identifier = 'Project identifier is required';
  } else if (args.project_identifier.trim().length > 5) {
    errors.project_identifier = 'Project identifier must be 1-5 characters';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
