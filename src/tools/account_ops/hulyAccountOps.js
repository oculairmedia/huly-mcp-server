/**
 * huly_account_ops - Account operations hub
 *
 * Consolidates account, employee, and person management into a single MCP tool
 * driven by discriminator-based operation dispatch.
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { coerceJsonFields } from '../base/jsonUtils.js';

const TOOL_NAME = 'huly_account_ops';

const EmployeeDataSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', description: 'First name' },
    lastName: { type: 'string', description: 'Last name' },
    email: { type: 'string', description: 'Work email' },
    position: { type: 'string', description: 'Job title' },
    department: { type: 'string', description: 'Department name' },
    city: { type: 'string', description: 'City location' },
    country: { type: 'string', description: 'Country location' },
    phone: { type: 'string', description: 'Phone number' },
    active: { type: 'boolean', description: 'Active status (default true)' },
  },
  required: ['firstName', 'lastName'],
  additionalProperties: false,
};

const EmployeeUpdateDataSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    position: { type: 'string' },
    department: { type: 'string' },
    city: { type: 'string' },
    country: { type: 'string' },
    phone: { type: 'string' },
    active: { type: 'boolean' },
    email: { type: 'string' },
  },
  minProperties: 1,
  additionalProperties: false,
};

const PersonDataSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', description: 'First name' },
    lastName: { type: 'string', description: 'Last name' },
    email: { type: 'string', description: 'Email address' },
    phone: { type: 'string', description: 'Phone number' },
    city: { type: 'string', description: 'City' },
    country: { type: 'string', description: 'Country' },
    birthday: { type: 'string', format: 'date', description: 'Birthday' },
  },
  required: ['firstName', 'lastName'],
  additionalProperties: false,
};

const EmployeeFiltersSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: 'Maximum number of employees to return.',
    },
    active: {
      type: 'boolean',
      description: 'Filter employees by active status.',
    },
    department: {
      type: 'string',
      description: 'Filter employees by department.',
    },
  },
  additionalProperties: false,
};

const OPERATION_HANDLERS = {
  async get_current(_args, context) {
    const { client, services } = context;
    const { accountService } = services;
    return accountService.getCurrentAccount(client);
  },
  async create_employee(args, context) {
    const { client, services } = context;
    const { employeeService } = services;
    return employeeService.createEmployee(client, args.data);
  },
  async update_employee(args, context) {
    const { client, services } = context;
    const { employeeService } = services;
    return employeeService.updateEmployee(client, args.employee_id, args.updates);
  },
  async delete_employee(args, context) {
    const { client, services } = context;
    const { employeeService } = services;
    if (!args.confirm) {
      return createErrorResponse('Confirmation required to delete employee');
    }
    if (!employeeService?.deleteEmployee) {
      throw new Error('EmployeeService delete operation not available');
    }
    return employeeService.deleteEmployee(client, args.employee_id);
  },
  async list_employees(args, context) {
    const { client, services } = context;
    const { employeeService } = services;
    return employeeService.listEmployees(client, args.filters ?? {});
  },
  async get_employee(args, context) {
    const { client, services } = context;
    const { employeeService } = services;
    return employeeService.getEmployee(client, args.employee_id);
  },
  async create_person(args, context) {
    const { client, services } = context;
    const { personService } = services;
    if (!personService?.createPerson) {
      throw new Error('PersonService not available');
    }
    const { firstName, lastName } = args.data || {};
    if (!firstName || !firstName.trim()) {
      return createErrorResponse('First name is required');
    }
    if (!lastName || !lastName.trim()) {
      return createErrorResponse('Last name is required');
    }
    return personService.createPerson(client, args.data);
  },
};

export const definition = {
  name: TOOL_NAME,
  description:
    'Account operations hub covering account inspection and employee/person management within the Huly workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'get_current',
          'create_employee',
          'update_employee',
          'delete_employee',
          'list_employees',
          'get_employee',
          'create_person',
        ],
        description:
          'Operation to perform. Required fields by operation:\n' +
          "- create_employee: data\n" +
          "- update_employee: employee_id, updates\n" +
          "- delete_employee: employee_id, confirm=true\n" +
          "- list_employees: filters optional\n" +
          "- get_employee: employee_id\n" +
          "- create_person: data",
      },
      data: {
        description:
          'Payload used for create operations. For employees see definitions.EmployeeData; for persons see definitions.PersonData.',
        oneOf: [
          EmployeeDataSchema,
          PersonDataSchema,
          {
            type: 'string',
            description: 'JSON string representing EmployeeData or PersonData.',
          },
        ],
      },
      employee_id: {
        type: 'string',
        description: 'Employee (Person) identifier required for update/delete/get operations.',
      },
      updates: {
        description: 'Partial employee fields to update when operation=update_employee.',
        oneOf: [
          EmployeeUpdateDataSchema,
          {
            type: 'string',
            description: 'JSON string representing EmployeeUpdateData.',
          },
        ],
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to delete employee status when operation=delete_employee.',
      },
      filters: {
        description: 'Optional filters for list_employees.',
        oneOf: [
          EmployeeFiltersSchema,
          {
            type: 'string',
            description: 'JSON string representing employee filters.',
          },
        ],
      },
    },
    required: ['operation'],
    additionalProperties: false,
    definitions: {
      EmployeeData: EmployeeDataSchema,
      EmployeeUpdateData: EmployeeUpdateDataSchema,
      EmployeeFilters: EmployeeFiltersSchema,
      PersonData: PersonDataSchema,
    },
  },
  annotations: {
    title: 'Account Operations Hub',
    destructiveHint: false,
    idempotentHint: false,
    readOnlyHint: false,
    openWorldHint: true,
  },
};

export async function handler(args, context) {
  const { operation } = args;
  const handlerFn = OPERATION_HANDLERS[operation];

  if (!handlerFn) {
    return createErrorResponse(`Unsupported operation: ${operation}`);
  }

  try {
    return await handlerFn(args, context);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export function validate(args) {
  if (!args || typeof args !== 'object') {
    return { args: 'Arguments must be an object' };
  }

  const { operation } = args;
  if (!operation) {
    return { operation: 'operation is required' };
  }

  if (!OPERATION_HANDLERS[operation]) {
    return { operation: `Unsupported operation: ${operation}` };
  }

  const errors = {};

  coerceJsonFields(args, errors, [
    { field: 'data', type: 'object' },
    { field: 'updates', type: 'object' },
    { field: 'filters', type: 'object' },
  ]);

  const requireField = (field, message) => {
    if (!args[field]) {
      errors[field] = message;
    }
  };

  const requireDataField = (field, message) => {
    if (!args.data || !args.data[field] || !String(args.data[field]).trim()) {
      errors[`data.${field}`] = message;
    }
  };

  switch (operation) {
    case 'create_employee':
      if (!args.data) {
        errors.data = 'data is required when creating an employee';
      } else {
        requireDataField('firstName', 'firstName is required when creating an employee');
        requireDataField('lastName', 'lastName is required when creating an employee');
      }
      break;
    case 'update_employee':
      requireField('employee_id', 'employee_id is required when updating an employee');
      if (!args.updates || Object.keys(args.updates).length === 0) {
        errors.updates = 'updates must include at least one field when updating an employee';
      }
      break;
    case 'delete_employee':
      requireField('employee_id', 'employee_id is required when deleting an employee');
      if (args.confirm !== true) {
        errors.confirm = 'confirm must be true to delete an employee';
      }
      break;
    case 'get_employee':
      requireField('employee_id', 'employee_id is required when retrieving an employee');
      break;
    case 'create_person':
      if (!args.data) {
        errors.data = 'data is required when creating a person';
      } else {
        requireDataField('firstName', 'firstName is required when creating a person');
        requireDataField('lastName', 'lastName is required when creating a person');
      }
      break;
    default:
      break;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
