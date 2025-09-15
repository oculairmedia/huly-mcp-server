/**
 * AccountService - Handles all account-related operations
 *
 * Provides methods for managing user accounts, workspace members,
 * and account settings in the Huly system.
 */

import { HulyError } from '../core/HulyError.js';
import { getLogger } from '../utils/Logger.js';
import contactModule from '@hcengineering/contact';
import coreModule from '@hcengineering/core';

const logger = getLogger('account-service');
const core = coreModule.default || coreModule;

/**
 * Service for managing accounts in Huly
 */
export class AccountService {
  constructor() {
    // Get class and mixin references from core and contact modules
    this.Account = core.class.Account;
    this.PersonAccount = contactModule.contactPlugin.class.PersonAccount;
    this.Person = contactModule.contactPlugin.class.Person;
    this.Contact = contactModule.contactPlugin.class.Contact;
    this.Employee = contactModule.contactPlugin.mixin.Employee;

    // Common account properties
    this.accountFields = ['email', 'first', 'last', 'role', 'confirmed'];
  }

  /**
   * Get current account information
   * @param {Object} client - Huly client
   * @returns {Promise<Object>} Current account details
   */
  async getCurrentAccount(client) {
    try {
      logger.debug('Getting current account');

      // Get current account from client context
      // Note: This may need adjustment based on how client provides current account info
      const currentAccountId = client.getCurrentAccountId?.() || client.accountId;

      if (!currentAccountId) {
        throw new HulyError('NO_CURRENT_ACCOUNT', 'No current account found in session');
      }

      const account = await client.findOne(this.Account, { _id: currentAccountId });
      if (!account) {
        throw HulyError.notFound('account', currentAccountId);
      }

      // Get associated person if exists
      let personDetails = null;
      try {
        const personAccount = await client.findOne(this.PersonAccount, {
          account: currentAccountId,
        });
        if (personAccount) {
          const person = await client.findOne(this.Person, { _id: personAccount.person });
          if (person) {
            personDetails = this._formatPersonInfo(person);
          }
        }
      } catch (error) {
        logger.warn('Failed to get person details for account', {
          error,
          accountId: currentAccountId,
        });
      }

      return this._formatAccountDetails(account, personDetails);
    } catch (error) {
      logger.error('Failed to get current account', { error });
      throw error;
    }
  }

  /**
   * Create a new account
   * @param {Object} client - Huly client
   * @param {Object} accountData - Account data
   * @returns {Promise<Object>} Created account details
   */
  async createAccount(client, accountData) {
    try {
      logger.debug('Creating account', { accountData: { ...accountData, password: '[REDACTED]' } });

      // Validate account data
      this._validateAccountData(accountData);

      // Check if account with email already exists
      const existingAccount = await client.findOne(this.Account, { email: accountData.email });
      if (existingAccount) {
        throw new HulyError(
          'ACCOUNT_EXISTS',
          `Account with email ${accountData.email} already exists`
        );
      }

      // Create account
      const accountId = await client.createDoc(this.Account, core.space.Model, {
        email: accountData.email,
        first: accountData.firstName || '',
        last: accountData.lastName || '',
        role: accountData.role || 'user',
        confirmed: accountData.confirmed || false,
        // Note: Password handling would need proper hashing in real implementation
        // This is a simplified version
      });

      logger.debug('Created account', { accountId });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Created account: ${accountData.email}\n\nAccount ID: ${accountId}\nName: ${accountData.firstName || ''} ${accountData.lastName || ''}\nRole: ${accountData.role || 'user'}\nConfirmed: ${accountData.confirmed || false}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to create account', {
        error,
        accountData: { ...accountData, password: '[REDACTED]' },
      });
      throw new HulyError('ACCOUNT_CREATION_FAILED', `Failed to create account: ${error.message}`);
    }
  }

  /**
   * Update account settings
   * @param {Object} client - Huly client
   * @param {string} accountId - Account ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Update result
   */
  async updateAccountSettings(client, accountId, settings) {
    try {
      logger.debug('Updating account settings', { accountId, settings });

      // Verify account exists
      const account = await client.findOne(this.Account, { _id: accountId });
      if (!account) {
        throw HulyError.notFound('account', accountId);
      }

      // Prepare updates
      const updates = {};

      if (settings.firstName !== undefined) updates.first = settings.firstName;
      if (settings.lastName !== undefined) updates.last = settings.lastName;
      if (settings.email !== undefined) {
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
          throw new HulyError('VALIDATION_FAILED', 'Invalid email format');
        }
        updates.email = settings.email;
      }
      if (settings.role !== undefined) updates.role = settings.role;
      if (settings.confirmed !== undefined) updates.confirmed = settings.confirmed;

      // Add any additional settings like timezone, locale, etc.
      if (settings.timezone !== undefined) updates.timezone = settings.timezone;
      if (settings.locale !== undefined) updates.locale = settings.locale;

      // Apply updates
      if (Object.keys(updates).length > 0) {
        await client.updateDoc(this.Account, core.space.Model, accountId, updates);
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ Updated account settings for ${accountId}\n\nUpdated fields: ${Object.keys(updates).join(', ')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to update account settings', { error, accountId, settings });
      throw new HulyError(
        'ACCOUNT_UPDATE_FAILED',
        `Failed to update account settings: ${error.message}`
      );
    }
  }

  /**
   * List workspace members
   * @param {Object} client - Huly client
   * @param {string} workspaceId - Workspace ID (optional, defaults to current workspace)
   * @param {Object} options - Filtering options
   * @returns {Promise<Object>} List of workspace members
   */
  async listWorkspaceMembers(client, workspaceId = null, options = {}) {
    try {
      logger.debug('Listing workspace members', { workspaceId, options });

      const { limit = 50, role = null, confirmed = null } = options;

      // Build query for accounts
      const query = {};
      if (role) query.role = role;
      if (confirmed !== null) query.confirmed = confirmed;

      // Get accounts (workspace members)
      const accounts = await client.findAll(this.Account, query, { limit });

      // Enhance with person details
      const memberDetails = [];
      for (const account of accounts) {
        try {
          let personInfo = null;

          // Try to get associated person
          const personAccount = await client.findOne(this.PersonAccount, { account: account._id });
          if (personAccount) {
            const person = await client.findOne(this.Person, { _id: personAccount.person });
            if (person) {
              personInfo = this._formatPersonInfo(person);

              // Check if person is an employee
              const employee = await client.findOne(this.Employee, { _id: person._id });
              if (employee) {
                personInfo.isEmployee = true;
                personInfo.employeeActive = employee.active;
                personInfo.position = employee.position;
                personInfo.department = employee.department;
              }
            }
          }

          memberDetails.push(this._formatMemberSummary(account, personInfo));
        } catch (error) {
          logger.warn('Failed to get person details for account', {
            error,
            accountId: account._id,
          });
          // Include account without person details
          memberDetails.push(this._formatMemberSummary(account, null));
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Found ${memberDetails.length} workspace members:\n\n${memberDetails.join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to list workspace members', { error, workspaceId, options });
      throw new HulyError(
        'WORKSPACE_MEMBERS_LIST_FAILED',
        `Failed to list workspace members: ${error.message}`
      );
    }
  }

  /**
   * Get account by email
   * @param {Object} client - Huly client
   * @param {string} email - Email address
   * @returns {Promise<Object>} Account details
   */
  async getAccountByEmail(client, email) {
    try {
      logger.debug('Getting account by email', { email });

      const account = await client.findOne(this.Account, { email });
      if (!account) {
        throw HulyError.notFound('account', email);
      }

      // Get associated person if exists
      let personDetails = null;
      try {
        const personAccount = await client.findOne(this.PersonAccount, { account: account._id });
        if (personAccount) {
          const person = await client.findOne(this.Person, { _id: personAccount.person });
          if (person) {
            personDetails = this._formatPersonInfo(person);
          }
        }
      } catch (error) {
        logger.warn('Failed to get person details for account', { error, accountId: account._id });
      }

      return this._formatAccountDetails(account, personDetails);
    } catch (error) {
      logger.error('Failed to get account by email', { error, email });
      throw error;
    }
  }

  // Private helper methods

  /**
   * Validate account data
   * @private
   */
  _validateAccountData(data) {
    if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
      throw new HulyError('VALIDATION_FAILED', 'Email is required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new HulyError('VALIDATION_FAILED', 'Invalid email format');
    }
    if (data.firstName && typeof data.firstName !== 'string') {
      throw new HulyError('VALIDATION_FAILED', 'First name must be a string');
    }
    if (data.lastName && typeof data.lastName !== 'string') {
      throw new HulyError('VALIDATION_FAILED', 'Last name must be a string');
    }
    if (data.role && !['user', 'admin', 'guest'].includes(data.role)) {
      throw new HulyError('VALIDATION_FAILED', 'Invalid role. Must be: user, admin, or guest');
    }
  }

  /**
   * Format account details for display
   * @private
   */
  _formatAccountDetails(account, personDetails = null) {
    let result = `# Account: ${account.email}\n\n`;
    result += `**Account ID**: ${account._id}\n`;
    result += `**Email**: ${account.email}\n`;
    result += `**Name**: ${account.first || ''} ${account.last || ''}\n`;
    result += `**Role**: ${account.role || 'user'}\n`;
    result += `**Confirmed**: ${account.confirmed ? 'Yes' : 'No'}\n`;

    if (account.timezone) result += `**Timezone**: ${account.timezone}\n`;
    if (account.locale) result += `**Locale**: ${account.locale}\n`;

    if (personDetails) {
      result += `\n## Associated Person Details:\n`;
      result += `**Person ID**: ${personDetails.id}\n`;
      result += `**Full Name**: ${personDetails.fullName}\n`;
      if (personDetails.location) result += `**Location**: ${personDetails.location}\n`;
      if (personDetails.phone) result += `**Phone**: ${personDetails.phone}\n`;
      if (personDetails.isEmployee) {
        result += `**Employee**: Yes (${personDetails.employeeActive ? 'Active' : 'Inactive'})\n`;
        if (personDetails.position) result += `**Position**: ${personDetails.position}\n`;
        if (personDetails.department) result += `**Department**: ${personDetails.department}\n`;
      }
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
   * Format person information
   * @private
   */
  _formatPersonInfo(person) {
    return {
      id: person._id,
      fullName: `${person.name.first} ${person.name.last}`,
      location: [person.city, person.country].filter(Boolean).join(', ') || null,
      phone: person.phone || null,
    };
  }

  /**
   * Format member summary for listing
   * @private
   */
  _formatMemberSummary(account, personInfo = null) {
    const name = personInfo
      ? personInfo.fullName
      : `${account.first || ''} ${account.last || ''}`.trim() || 'Unknown';
    const roleIcon = account.role === 'admin' ? '👑' : account.role === 'guest' ? '👤' : '👥';
    const status = account.confirmed ? '✅ Confirmed' : '⏳ Pending';

    let result = `${roleIcon} **${name}** (${account.email})\n`;
    result += `   ${status} - Role: ${account.role || 'user'}`;

    if (personInfo && personInfo.isEmployee) {
      const empStatus = personInfo.employeeActive ? '✅ Active' : '❌ Inactive';
      result += `\n   👷 Employee: ${empStatus}`;
      if (personInfo.position) result += ` - ${personInfo.position}`;
    }

    return result;
  }
}

// Export singleton instance
export const accountService = new AccountService();
