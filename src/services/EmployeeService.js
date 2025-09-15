/**
 * EmployeeService - Handles all employee-related operations
 *
 * Provides methods for creating, updating, listing, and managing employees
 * in the Huly contact system.
 */

import { HulyError } from '../core/HulyError.js';
import { getLogger } from '../utils/Logger.js';
import contactModule from '@hcengineering/contact';
import coreModule from '@hcengineering/core';

const logger = getLogger('employee-service');
const core = coreModule.default || coreModule;

/**
 * Service for managing employees in Huly
 */
export class EmployeeService {
  constructor() {
    // Get class and mixin references
    this.Contact = contactModule.contactPlugin.class.Contact;
    this.Person = contactModule.contactPlugin.class.Person;
    this.Employee = contactModule.contactPlugin.mixin.Employee;
    this.PersonAccount = contactModule.contactPlugin.class.PersonAccount;
    this.Account = core.class.Account;
  }

  /**
   * Create a new employee (Person with Employee mixin)
   * @param {Object} client - Huly client
   * @param {Object} employeeData - Employee data
   * @returns {Promise<Object>} Result with employee ID
   */
  async createEmployee(client, employeeData) {
    try {
      logger.debug('Creating employee', { employeeData });

      // Validate required fields
      this._validateEmployeeData(employeeData);

      // Create PersonName object
      const personName = this._createPersonName(employeeData);

      // Create Person entity first
      const personId = await client.createDoc(this.Person, core.space.Model, {
        name: personName,
        city: employeeData.city || '',
        country: employeeData.country || '',
        phone: employeeData.phone || '',
        // Add avatar info if needed
        avatar: null,
      });

      logger.debug('Created Person entity', { personId });

      // Apply Employee mixin to the Person
      await client.createMixin(personId, this.Person, core.space.Model, this.Employee, {
        active: employeeData.active !== false, // Default to true
        position: employeeData.position || '',
        // Note: role and department might need special handling
        // depending on how they're implemented in Huly
      });

      logger.debug('Applied Employee mixin', { personId });

      // If email provided, try to link to account
      if (employeeData.email) {
        try {
          await this._linkEmployeeToAccount(client, personId, employeeData.email);
        } catch (error) {
          logger.warn('Failed to link employee to account', { error, email: employeeData.email });
          // Don't fail the employee creation if account linking fails
        }
      }

      // Return success response
      return {
        content: [
          {
            type: 'text',
            text: `✅ Created employee: ${this._formatEmployeeName(employeeData)}\n\nEmployee ID: ${personId}\nStatus: Active\n${employeeData.email ? `Email: ${employeeData.email}\n` : ''}${employeeData.position ? `Position: ${employeeData.position}\n` : ''}${employeeData.department ? `Department: ${employeeData.department}\n` : ''}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to create employee', { error, employeeData });
      throw new HulyError(
        'EMPLOYEE_CREATION_FAILED',
        `Failed to create employee: ${error.message}`
      );
    }
  }

  /**
   * Get employee details by ID
   * @param {Object} client - Huly client
   * @param {string} employeeId - Employee ID
   * @returns {Promise<Object>} Employee details
   */
  async getEmployee(client, employeeId) {
    try {
      logger.debug('Getting employee', { employeeId });

      // Find the person with employee mixin
      const person = await client.findOne(this.Person, { _id: employeeId });
      if (!person) {
        throw HulyError.notFound('employee', employeeId);
      }

      // Check if they have Employee mixin
      const employee = await client.findOne(this.Employee, { _id: employeeId });
      if (!employee) {
        throw new HulyError('NOT_EMPLOYEE', 'Person is not an employee');
      }

      return this._formatEmployeeDetails(person, employee);
    } catch (error) {
      logger.error('Failed to get employee', { error, employeeId });
      throw error;
    }
  }

  /**
   * List employees with optional filtering
   * @param {Object} client - Huly client
   * @param {Object} options - Filtering options
   * @returns {Promise<Object>} List of employees
   */
  async listEmployees(client, options = {}) {
    try {
      logger.debug('Listing employees', { options });

      const { limit = 50, active = null, department = null } = options;

      // Build query for Employee mixin
      const query = {};
      if (active !== null) {
        query.active = active;
      }
      if (department) {
        query.department = department;
      }

      // Find employees with the mixin
      const employees = await client.findAll(this.Employee, query, { limit });

      // Get corresponding Person data
      const employeeDetails = [];
      for (const employee of employees) {
        try {
          const person = await client.findOne(this.Person, { _id: employee._id });
          if (person) {
            employeeDetails.push(this._formatEmployeeSummary(person, employee));
          }
        } catch (error) {
          logger.warn('Failed to get person data for employee', {
            error,
            employeeId: employee._id,
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Found ${employeeDetails.length} employees:\n\n${employeeDetails.join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to list employees', { error, options });
      throw new HulyError('EMPLOYEE_LIST_FAILED', `Failed to list employees: ${error.message}`);
    }
  }

  /**
   * Update employee information
   * @param {Object} client - Huly client
   * @param {string} employeeId - Employee ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Update result
   */
  async updateEmployee(client, employeeId, updates) {
    try {
      logger.debug('Updating employee', { employeeId, updates });

      // Verify employee exists
      await this.getEmployee(client, employeeId);

      // Separate person updates from employee updates
      const personUpdates = {};
      const employeeUpdates = {};

      // Map updates to appropriate entity
      if (updates.firstName || updates.lastName) {
        const person = await client.findOne(this.Person, { _id: employeeId });
        personUpdates.name = {
          ...person.name,
          first: updates.firstName || person.name.first,
          last: updates.lastName || person.name.last,
        };
      }
      if (updates.city) personUpdates.city = updates.city;
      if (updates.country) personUpdates.country = updates.country;
      if (updates.phone) personUpdates.phone = updates.phone;

      if (updates.active !== undefined) employeeUpdates.active = updates.active;
      if (updates.position) employeeUpdates.position = updates.position;
      if (updates.department) employeeUpdates.department = updates.department;

      // Apply person updates
      if (Object.keys(personUpdates).length > 0) {
        await client.updateDoc(this.Person, core.space.Model, employeeId, personUpdates);
      }

      // Apply employee updates
      if (Object.keys(employeeUpdates).length > 0) {
        await client.updateMixin(
          employeeId,
          this.Person,
          core.space.Model,
          this.Employee,
          employeeUpdates
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Updated employee ${employeeId}\n\nUpdated fields: ${Object.keys({ ...personUpdates, ...employeeUpdates }).join(', ')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to update employee', { error, employeeId, updates });
      throw new HulyError('EMPLOYEE_UPDATE_FAILED', `Failed to update employee: ${error.message}`);
    }
  }

  /**
   * Delete employee (deactivate Employee but keep Person)
   * @param {Object} client - Huly client
   * @param {string} employeeId - Employee ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteEmployee(client, employeeId) {
    try {
      logger.debug('Deleting employee', { employeeId });

      // Verify employee exists
      await this.getEmployee(client, employeeId);

      // Deactivate employee instead of removing mixin (safer approach)
      await client.updateMixin(employeeId, this.Person, core.space.Model, this.Employee, {
        active: false,
      });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Deactivated employee ${employeeId}\n\nNote: Employee marked as inactive but records retained for historical purposes.`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to delete employee', { error, employeeId });
      throw new HulyError('EMPLOYEE_DELETE_FAILED', `Failed to delete employee: ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Validate employee data
   * @private
   */
  _validateEmployeeData(data) {
    if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim() === '') {
      throw new HulyError('VALIDATION_FAILED', 'First name is required');
    }
    if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim() === '') {
      throw new HulyError('VALIDATION_FAILED', 'Last name is required');
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new HulyError('VALIDATION_FAILED', 'Invalid email format');
    }
  }

  /**
   * Create PersonName object
   * @private
   */
  _createPersonName(data) {
    return {
      first: data.firstName.trim(),
      last: data.lastName.trim(),
      ...(data.middleName && { middle: data.middleName.trim() }),
    };
  }

  /**
   * Format employee name for display
   * @private
   */
  _formatEmployeeName(data) {
    return `${data.firstName} ${data.lastName}`;
  }

  /**
   * Format employee details for display
   * @private
   */
  _formatEmployeeDetails(person, employee) {
    const fullName = `${person.name.first} ${person.name.last}`;
    let result = `# Employee: ${fullName}\n\n`;
    result += `**Employee ID**: ${person._id}\n`;
    result += `**Active**: ${employee.active ? 'Yes' : 'No'}\n`;
    result += `**Position**: ${employee.position || 'Not specified'}\n`;
    result += `**Department**: ${employee.department || 'Not specified'}\n`;
    if (person.city || person.country) {
      result += `**Location**: ${[person.city, person.country].filter(Boolean).join(', ')}\n`;
    }
    if (person.phone) {
      result += `**Phone**: ${person.phone}\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  /**
   * Format employee summary for listing
   * @private
   */
  _formatEmployeeSummary(person, employee) {
    const fullName = `${person.name.first} ${person.name.last}`;
    const status = employee.active ? '✅ Active' : '❌ Inactive';
    const position = employee.position ? ` - ${employee.position}` : '';
    return `👤 **${fullName}** (${person._id})\n   ${status}${position}`;
  }

  /**
   * Link employee to account by email
   * @private
   */
  async _linkEmployeeToAccount(client, personId, email) {
    try {
      // Find account by email
      const account = await client.findOne(this.Account, { email });
      if (account) {
        // Create PersonAccount link
        await client.createDoc(this.PersonAccount, core.space.Model, {
          person: personId,
          account: account._id,
          email,
        });
        logger.debug('Linked employee to account', { personId, accountId: account._id, email });
      } else {
        logger.debug('No account found for email', { email });
      }
    } catch (error) {
      logger.error('Failed to link employee to account', { error, personId, email });
      throw error;
    }
  }
}

// Export singleton instance
export const employeeService = new EmployeeService();
