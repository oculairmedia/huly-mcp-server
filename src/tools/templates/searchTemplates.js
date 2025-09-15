/**
 * Search Templates Tool
 *
 * Search for templates by title and description
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_search_templates',
  description: 'Execute sophisticated search operations across issue templates with advanced query capabilities, full-text search functionality, and flexible result customization for comprehensive template discovery and workflow analysis. This powerful search tool supports intelligent queries across template titles and descriptions, cross-project template discovery for workspace-wide workflow standardization, and configurable result limits for performance optimization. The search engine provides intelligent result ranking based on relevance, usage frequency, and template complexity, along with comprehensive metadata including match scores, highlighting, and contextual information about template structure and usage patterns. Advanced features include support for complex search patterns, wildcard matching, and nested query structures that enable sophisticated template analytics and organizational workflow analysis. The tool automatically handles user permission filtering to ensure secure access to authorized templates while providing comprehensive result metadata including template hierarchy information, usage statistics, and relationship details. This tool is indispensable for template governance, workflow standardization, organizational planning, and team onboarding scenarios requiring efficient template discovery, workflow pattern analysis, and comprehensive understanding of available standardized processes across diverse project types and organizational contexts.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for template title and description',
      },
      project_identifier: {
        type: 'string',
        description: 'Project identifier to search within (optional for cross-project search)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50)',
        default: 50,
      },
    },
    required: ['query'],
  },
  annotations: {
    title: 'Search Templates',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
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
  const { templateService } = services;

  try {
    logger.debug('Searching templates', args);

    const result = await templateService.searchTemplates(
      client,
      args.query,
      args.project_identifier,
      args.limit
    );

    return result;
  } catch (error) {
    logger.error('Failed to search templates:', error);
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

  // Validate query
  if (!args.query || args.query.trim().length === 0) {
    errors.query = 'Search query is required';
  }

  // Validate limit
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
