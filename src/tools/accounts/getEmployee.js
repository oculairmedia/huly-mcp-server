/**
 * Get Employee Tool
 *
 * Retrieves detailed information about a specific employee
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_get_employee',
  description:
    'Retrieve comprehensive details about a specific employee including personal information, work-related data, contact details, and current status. This tool provides complete visibility into employee records for team management, reporting, and administrative purposes.',
  inputSchema: {
    type: 'object',
    properties: {
      employee_id: {
        type: 'string',
        description: 'Employee ID (Person entity identifier)',
      },
    },
    required: ['employee_id'],
  },
  annotations: {
    title: 'Get Employee Details',
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
    logger.debug('Getting employee details', args);

    // Validate required services
    if (!employeeService) {
      throw new Error('EmployeeService not available');
    }

    const result = await employeeService.getEmployee(client, args.employee_id);

    return result;
  } catch (error) {
    logger.error('Failed to get employee details', { error: error.message, args });
    return createErrorResponse(`Failed to get employee details: ${error.message}`);
  }
}
