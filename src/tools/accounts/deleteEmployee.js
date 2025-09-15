/**
 * Delete Employee Tool
 *
 * Removes employee status while preserving person record
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_delete_employee',
  description:
    'Remove employee status from a person while preserving the underlying person record for historical purposes. This tool performs a soft deletion by removing the Employee mixin, effectively "terminating" employment while maintaining data integrity for audit trails, historical reporting, and compliance requirements. The person record remains accessible for reference but is no longer considered an active employee.',
  inputSchema: {
    type: 'object',
    properties: {
      employee_id: {
        type: 'string',
        description: 'Employee ID (Person entity identifier) to remove employee status from',
      },
      confirm: {
        type: 'boolean',
        description: 'Confirmation required to proceed with employee deletion (must be true)',
      },
    },
    required: ['employee_id', 'confirm'],
  },
  annotations: {
    title: 'Delete Employee',
    readOnlyHint: false,
    destructiveHint: true,
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
  const { employeeService } = services;

  try {
    logger.debug('Deleting employee', args);

    // Validate required services
    if (!employeeService) {
      throw new Error('EmployeeService not available');
    }

    // Validate confirmation
    if (!args.confirm) {
      throw new Error(
        'Confirmation required: set confirm parameter to true to proceed with employee deletion'
      );
    }

    const result = await employeeService.deleteEmployee(client, args.employee_id);

    return result;
  } catch (error) {
    logger.error('Failed to delete employee', { error: error.message, args });
    return createErrorResponse(`Failed to delete employee: ${error.message}`);
  }
}
