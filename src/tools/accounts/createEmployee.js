/**
 * Create Employee Tool
 *
 * Creates a new employee in the Huly workspace with personal and work-related information
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_employee',
  description:
    'Create a new employee in the Huly workspace with personal and work-related information. This tool establishes employee records that can be used for issue assignments, project management, and team organization. Employees are created as Person entities with Employee mixin containing work-specific details like role, active status, and contact information. The tool validates input data, creates the Person entity, applies the Employee mixin, and optionally links to existing accounts via email.',
  inputSchema: {
    type: 'object',
    properties: {
      first_name: {
        type: 'string',
        description: 'Employee first name (required)',
        minLength: 1,
        maxLength: 50,
      },
      last_name: {
        type: 'string',
        description: 'Employee last name (required)',
        minLength: 1,
        maxLength: 50,
      },
      middle_name: {
        type: 'string',
        description: 'Employee middle name (optional)',
        maxLength: 50,
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Employee email address (optional - for account linking)',
      },
      phone: {
        type: 'string',
        description: 'Phone number (optional)',
        maxLength: 20,
      },
      position: {
        type: 'string',
        description: 'Job title or position (optional)',
        maxLength: 100,
      },
      department: {
        type: 'string',
        description: 'Department or team name (optional)',
        maxLength: 100,
      },
      city: {
        type: 'string',
        description: 'City location (optional)',
        maxLength: 50,
      },
      country: {
        type: 'string',
        description: 'Country location (optional)',
        maxLength: 50,
      },
      active: {
        type: 'boolean',
        default: true,
        description: 'Whether the employee is active in the system (default: true)',
      },
    },
    required: ['first_name', 'last_name'],
  },
  annotations: {
    title: 'Create Employee',
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
    logger.debug('Creating employee', args);

    // Validate required services
    if (!employeeService) {
      throw new Error('EmployeeService not available');
    }

    // Transform arguments to match service expected format
    const employeeData = {
      firstName: args.first_name,
      lastName: args.last_name,
      middleName: args.middle_name,
      email: args.email,
      phone: args.phone,
      position: args.position,
      department: args.department,
      city: args.city,
      country: args.country,
      active: args.active !== false, // Default to true
    };

    const result = await employeeService.createEmployee(client, employeeData);

    return result;
  } catch (error) {
    logger.error('Failed to create employee', { error: error.message, args });
    return createErrorResponse(`Failed to create employee: ${error.message}`);
  }
}
