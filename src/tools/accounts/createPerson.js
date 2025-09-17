/**
 * Create Person Tool
 *
 * Creates a new person in the Huly contact system with comprehensive validation,
 * duplicate checking, and optional account linking for complete person management.
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_create_person',
  description:
    'Create a new person in the Huly workspace with personal and contact information. This tool establishes person records that can be used for future employee conversion, account linking, and contact management. Persons are created as Contact entities with comprehensive validation including duplicate checking by email address. The tool validates input data, creates the Person entity with proper name structures, and optionally links to existing accounts via email for seamless integration with the Huly authentication system.',
  inputSchema: {
    type: 'object',
    properties: {
      first_name: {
        type: 'string',
        description: 'Person first name (required)',
        minLength: 1,
        maxLength: 50,
      },
      last_name: {
        type: 'string',
        description: 'Person last name (required)',
        minLength: 1,
        maxLength: 50,
      },
      middle_name: {
        type: 'string',
        description: 'Person middle name (optional)',
        maxLength: 50,
      },
      email: {
        type: 'string',
        description: 'Email address for account linking (optional)',
        format: 'email',
      },
      phone: {
        type: 'string',
        description: 'Phone number (optional)',
        maxLength: 20,
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
      birthday: {
        type: 'string',
        description: 'Birthday in ISO date format (optional)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      },
    },
    required: ['first_name', 'last_name'],
  },
  annotations: {
    title: 'Create Person',
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
  const { personService } = services;

  try {
    logger.debug('Creating person', args);

    // Validate required services
    if (!personService) {
      throw new Error('PersonService not available');
    }

    // Validate required fields
    if (
      !args.first_name ||
      typeof args.first_name !== 'string' ||
      args.first_name.trim().length === 0
    ) {
      throw new Error('first_name is required and must be a non-empty string');
    }

    if (
      !args.last_name ||
      typeof args.last_name !== 'string' ||
      args.last_name.trim().length === 0
    ) {
      throw new Error('last_name is required and must be a non-empty string');
    }

    // Transform input arguments to match PersonService expected format
    const personData = {
      firstName: args.first_name,
      lastName: args.last_name,
      middleName: args.middle_name,
      email: args.email,
      phone: args.phone,
      city: args.city,
      country: args.country,
      birthday: args.birthday,
    };

    // Use PersonService to create the person
    const result = await personService.createPerson(client, personData);

    return result;
  } catch (error) {
    logger.error('Failed to create person', { error: error.message, args });
    return createErrorResponse(`Failed to create person: ${error.message}`);
  }
}
