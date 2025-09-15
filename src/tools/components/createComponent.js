/**
 * Create Component Tool
 *
 * Creates a new component in a project
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_component',
  description:
    'Establish new organizational components within projects to enable sophisticated issue categorization, team responsibility assignment, and architectural organization that enhances project structure and workflow efficiency. This fundamental organizational tool creates logical groupings for issues based on functional areas, technical modules, team ownership, or any custom categorization scheme that supports project management and development workflows. The component creation process automatically integrates with existing project infrastructure, enabling immediate use in issue creation, filtering, and reporting while supporting rich descriptions with markdown formatting for detailed component documentation. Advanced features include automatic validation of component uniqueness within projects, comprehensive permission inheritance from parent projects, and seamless integration with search and filtering systems across all issue management tools. Components serve as critical organizational elements for large-scale projects, enabling team-based issue assignment, architectural separation of concerns, and detailed project analytics through component-specific reporting and metrics. This tool is essential for project initialization, team organization, architectural planning, and ongoing project structure refinement, providing the foundational categorization framework that supports efficient issue management, clear responsibility assignment, and comprehensive project organization across diverse development and operational contexts.',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier (e.g., "WEBHOOK")',
      },
      label: {
        type: 'string',
        description: 'Component name',
      },
      description: {
        type: 'string',
        description: 'Component description',
      },
    },
    required: ['project_identifier', 'label'],
  },
  annotations: {
    title: 'Create Component',
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
