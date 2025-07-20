/**
 * Search Issues Tool
 * 
 * Search and filter issues with advanced capabilities
 */

import { createToolResponse, createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_search_issues',
  description: 'Search and filter issues with advanced capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      project_identifier: {
        type: 'string',
        description: 'Project identifier to search within (optional for cross-project search)'
      },
      query: {
        type: 'string',
        description: 'Search query for title and description (optional)'
      },
      status: {
        type: 'string',
        description: 'Filter by status (e.g., "Backlog", "In Progress", "Done")'
      },
      priority: {
        type: 'string',
        description: 'Filter by priority (low, medium, high, urgent, NoPriority)',
        enum: ['low', 'medium', 'high', 'urgent', 'NoPriority']
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee ID or username'
      },
      component: {
        type: 'string',
        description: 'Filter by component name'
      },
      milestone: {
        type: 'string',
        description: 'Filter by milestone name'
      },
      created_after: {
        type: 'string',
        description: 'Filter issues created after this date (ISO 8601 format)'
      },
      created_before: {
        type: 'string',
        description: 'Filter issues created before this date (ISO 8601 format)'
      },
      modified_after: {
        type: 'string',
        description: 'Filter issues modified after this date (ISO 8601 format)'
      },
      modified_before: {
        type: 'string',
        description: 'Filter issues modified before this date (ISO 8601 format)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50)',
        default: 50
      }
    },
    required: []
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
  const { issueService } = services;
  
  try {
    logger.debug('Searching issues', args);
    
    const result = await issueService.searchIssues(client, args);
    
    return result;
  } catch (error) {
    logger.error('Failed to search issues:', error);
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
  
  // Validate dates if provided
  const dateFields = ['created_after', 'created_before', 'modified_after', 'modified_before'];
  for (const field of dateFields) {
    if (args[field]) {
      const date = new Date(args[field]);
      if (isNaN(date.getTime())) {
        errors[field] = `Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)`;
      }
    }
  }
  
  // Validate limit if provided
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      errors.limit = 'Limit must be a positive number';
    }
  }
  
  // Validate priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent', 'NoPriority'];
  if (args.priority && !validPriorities.includes(args.priority)) {
    errors.priority = `Priority must be one of: ${validPriorities.join(', ')}`;
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}