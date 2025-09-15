/**
 * Update Employee Tool
 *
 * Updates employee information with flexible field modification
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_update_employee',
  description:
    'Update specific fields of existing employee records with comprehensive validation and atomic update operations. This tool supports modification of personal information, work-related data, contact details, and employment status while maintaining data consistency and audit trail integrity throughout the modification process.',
  inputSchema: {
    type: 'object',
    properties: {
      employee_id: {
        type: 'string',
        description: 'Employee ID (Person entity identifier) to update',
      },
      first_name: {
        type: 'string',
        description: 'Updated first name (optional)',
        minLength: 1,
        maxLength: 50
      },
      last_name: {
        type: 'string',
        description: 'Updated last name (optional)',
        minLength: 1,
        maxLength: 50
      },
      phone: {
        type: 'string',
        description: 'Updated phone number (optional)',
        maxLength: 20
      },
      position: {
        type: 'string',
        description: 'Updated job title or position (optional)',
        maxLength: 100
      },
      department: {
        type: 'string',
        description: 'Updated department or team name (optional)',
        maxLength: 100
      },
      city: {
        type: 'string',
        description: 'Updated city location (optional)',
        maxLength: 50
      },
      country: {
        type: 'string',
        description: 'Updated country location (optional)',
        maxLength: 50
      },
      active: {
        type: 'boolean',
        description: 'Updated employment status (optional)',
      },
    },
    required: ['employee_id'],
  },
  annotations: {
    title: 'Update Employee',
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
  const { employeeService } = services;

  try {
    logger.debug('Updating employee', args);

    // Validate required services
    if (!employeeService) {
      throw new Error('EmployeeService not available');
    }

    // Extract employee_id and prepare updates
    const { employee_id, ...updates } = args;

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new Error('No updates provided');
    }

    const result = await employeeService.updateEmployee(client, employee_id, cleanUpdates);

    return result;
  } catch (error) {
    logger.error('Failed to update employee', { error: error.message, args });
    return createErrorResponse(`Failed to update employee: ${error.message}`);
  }
}