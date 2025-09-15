/**
 * Remove Child Template Tool
 *
 * Removes a child template from a parent template
 */

import { createErrorResponse } from '../base/ToolInterface.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_remove_child_template',
  description:
    'Precisely remove specific child templates from parent template hierarchies using index-based selection, enabling fine-grained template structure management and workflow optimization while maintaining template integrity and organizational consistency. This specialized template management tool provides surgical modification capabilities for complex template hierarchies, allowing selective removal of child templates without affecting other template components or disrupting existing workflow patterns. The removal process includes comprehensive validation of parent template existence, child template index verification, user permissions, and hierarchical structure integrity, followed by atomic removal that maintains template consistency and prevents workflow disruption. Advanced features include automatic index validation with bounds checking, comprehensive error handling for invalid selections, detailed audit logging for template modification tracking, and preservation of template history for compliance and recovery purposes. The tool supports complex organizational scenarios requiring precise template evolution, workflow refinement, and iterative template development while maintaining backward compatibility with existing template usage patterns and ensuring seamless integration with template instantiation workflows. This tool is essential for template lifecycle management, workflow optimization, organizational adaptation, and administrative scenarios requiring reliable, auditable template hierarchy modification capabilities with surgical precision and full consideration for complex organizational dependencies and standardized workflow evolution.',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Parent template ID',
      },
      child_index: {
        type: 'number',
        description: 'Index of the child template to remove (0-based)',
      },
    },
    required: ['template_id', 'child_index'],
  },
  annotations: {
    title: 'Remove Child Template',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
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
    logger.debug('Removing child template', args);

    const result = await templateService.removeChildTemplate(
      client,
      args.template_id,
      args.child_index
    );

    return result;
  } catch (error) {
    logger.error('Failed to remove child template:', error);
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

  // Validate template ID
  if (!args.template_id || args.template_id.trim().length === 0) {
    errors.template_id = 'Template ID is required';
  }

  // Validate child index
  if (args.child_index === undefined || typeof args.child_index !== 'number') {
    errors.child_index = 'Child index must be a non-negative integer';
  } else if (args.child_index < 0) {
    errors.child_index = 'Child index must be a non-negative integer';
  } else if (!Number.isInteger(args.child_index)) {
    errors.child_index = 'Child index must be an integer';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
