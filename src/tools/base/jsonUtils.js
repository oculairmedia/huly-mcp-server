/**
 * Utility helpers for MCP tool validators.
 *
 * Provides lightweight JSON coercion so MCP clients that stringify nested
 * arguments (common when adapters cannot send structured payloads) can still
 * interact with consolidated tools expecting objects or arrays.
 */

/**
 * Coerce specific fields on the args object into objects/arrays when they
 * arrive as JSON strings. Any parsing errors are surfaced via the provided
 * errors map so existing validation continues to work as expected.
 *
 * @param {Object} args - Raw arguments provided to the validator.
 * @param {Object} errors - Mutable map of validation errors to populate.
 * @param {Array<{field: string, type: 'object'|'array'}>} coercions - Fields to coerce.
 */
export function coerceJsonFields(args, errors, coercions) {
  if (!args || typeof args !== 'object' || !Array.isArray(coercions)) {
    return;
  }

  for (const { field, type } of coercions) {
    if (!field || !type) {
      continue;
    }

    if (errors[field]) {
      // Preserve the more specific error if validation already set one.
      continue;
    }

    if (!(field in args) || args[field] === undefined || args[field] === null) {
      continue;
    }

    const rawValue = args[field];

    const assignError = (message) => {
      errors[field] = message;
    };

    if (type === 'object') {
      if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        continue;
      }

      if (typeof rawValue === 'string') {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            args[field] = parsed;
            continue;
          }
          assignError(`${field} must be a JSON object`);
        } catch (error) {
          assignError(`${field} must be valid JSON object: ${error.message}`);
        }
        continue;
      }

      assignError(`${field} must be an object or JSON string representing one`);
      continue;
    }

    if (type === 'array') {
      if (Array.isArray(rawValue)) {
        continue;
      }

      if (typeof rawValue === 'string') {
        try {
          const parsed = JSON.parse(rawValue);
          if (Array.isArray(parsed)) {
            args[field] = parsed;
            continue;
          }
          assignError(`${field} must be a JSON array`);
        } catch (error) {
          assignError(`${field} must be valid JSON array: ${error.message}`);
        }
        continue;
      }

      assignError(`${field} must be an array or JSON string representing one`);
      continue;
    }
  }
}
