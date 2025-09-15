/**
 * Account Management Tools
 *
 * Collection of MCP tools for managing user accounts and employees
 * in the Huly system.
 */

// Employee Management Tools
import { createEmployeeTool } from './createEmployee.js';
import { getEmployeeTool } from './getEmployee.js';
import { listEmployeesTool } from './listEmployees.js';
import { updateEmployeeTool } from './updateEmployee.js';
import { deleteEmployeeTool } from './deleteEmployee.js';

// Account Management Tools
import { getCurrentAccountTool } from './getCurrentAccount.js';

// Re-export for external use
export { createEmployeeTool } from './createEmployee.js';
export { getEmployeeTool } from './getEmployee.js';
export { listEmployeesTool } from './listEmployees.js';
export { updateEmployeeTool } from './updateEmployee.js';
export { deleteEmployeeTool } from './deleteEmployee.js';
export { getCurrentAccountTool } from './getCurrentAccount.js';

/**
 * Get all account management tools
 * @returns {Array} Array of tool instances
 */
export function getAllAccountTools() {
  return [
    // Employee tools
    createEmployeeTool,
    getEmployeeTool,
    listEmployeesTool,
    updateEmployeeTool,
    deleteEmployeeTool,
    // Account tools
    getCurrentAccountTool,
  ];
}

/**
 * Get employee management tools only
 * @returns {Array} Array of employee tool instances
 */
export function getEmployeeTools() {
  return [
    createEmployeeTool,
    getEmployeeTool,
    listEmployeesTool,
    updateEmployeeTool,
    deleteEmployeeTool,
  ];
}

/**
 * Get account management tools only
 * @returns {Array} Array of account tool instances
 */
export function getAccountTools() {
  return [getCurrentAccountTool];
}
