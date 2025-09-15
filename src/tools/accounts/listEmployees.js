/**
 * List Employees Tool
 *
 * Lists employees in the Huly workspace with optional filtering
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_list_employees',
  description:
    'Retrieve a comprehensive listing of employees within the Huly workspace with optional filtering capabilities. This tool provides essential employee metadata including names, positions, departments, activity status, and contact information for effective team management and organizational oversight. The listing supports configurable result limits and filtering by active status or department for focused employee analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of employees to return (default: 50, max: 100)',
        default: 50,
        minimum: 1,
        maximum: 100,
      },
      active: {
        type: 'boolean',
        description: 'Filter by active status (true for active only, false for inactive only, omit for all)',
      },
      department: {
        type: 'string',
        description: 'Filter by department name (optional)',
      },
    },
    required: [],
  },
  annotations: {
    title: 'List Employees',
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
  const { employeeService } = services;

  try {
    logger.debug('Listing employees', args);

    // Validate required services
    if (!employeeService) {
      throw new Error('EmployeeService not available');
    }

    const result = await employeeService.listEmployees(client, args);

    return result;
  } catch (error) {
    logger.error('Failed to list employees', { error: error.message, args });
    return createErrorResponse(`Failed to list employees: ${error.message}`);
  }
}