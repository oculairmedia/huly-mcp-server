/**
 * PersonService - Handles all person/contact-related operations
 *
 * Provides methods for creating, updating, and managing person entities
 * in the Huly contact system. Handles core person data without employee-specific functionality.
 */

import { HulyError } from '../core/HulyError.js';
import { getLogger } from '../utils/Logger.js';
import contactModule from '@hcengineering/contact';
import coreModule from '@hcengineering/core';

const logger = getLogger('person-service');
const core = coreModule.default || coreModule;

/**
 * Service for managing person entities in Huly
 */
export class PersonService {
  constructor() {
    // Get class references from contact and core modules
    this.Contact = contactModule.contactPlugin.class.Contact;
    this.Person = contactModule.contactPlugin.class.Person;
    this.PersonAccount = contactModule.contactPlugin.class.PersonAccount;
    this.Employee = contactModule.contactPlugin.mixin.Employee;
    this.Account = core.class.Account;
  }

  /**
   * Create a new person
   * @param {Object} client - Huly client
   * @param {Object} personData - Person data
   * @returns {Promise<Object>} Created person details
   */
  async createPerson(client, personData) {
    try {
      logger.debug('Creating person', { personData });

      // Validate required fields
      this._validatePersonData(personData);

      // Check if person with email already exists (if email provided)
      if (personData.email) {
        const existingPerson = await this.findPersonByEmail(client, personData.email);
        if (existingPerson) {
          throw new HulyError(
            'PERSON_EXISTS',
            `Person with email ${personData.email} already exists`
          );
        }
      }

      // Create PersonName object
      const personName = this._createPersonName(personData);

      // Create Person entity
      const personId = await client.createDoc(this.Person, core.space.Model, {
        name: personName,
        city: personData.city || '',
        country: personData.country || '',
        phone: personData.phone || '',
        birthday: personData.birthday || null,
        avatar: null, // Will be set later via setPersonAvatar if needed
      });

      logger.debug('Created Person entity', { personId });

      // Link to account if email provided
      if (personData.email) {
        try {
          await this._linkPersonToAccount(client, personId, personData.email);
        } catch (error) {
          logger.warn('Failed to link person to account', { error, email: personData.email });
          // Don't fail person creation if account linking fails
        }
      }

      // Get the created person for response
      const _createdPerson = await client.findOne(this.Person, { _id: personId });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Created person: ${this._formatPersonName(personData)}

**Person ID**: ${personId}
**Name**: ${personData.firstName} ${personData.lastName}
${personData.email ? `**Email**: ${personData.email}\n` : ''}${personData.phone ? `**Phone**: ${personData.phone}\n` : ''}${personData.city ? `**City**: ${personData.city}\n` : ''}${personData.country ? `**Country**: ${personData.country}\n` : ''}${personData.birthday ? `**Birthday**: ${personData.birthday}\n` : ''}

🔗 Person can now be used for employee conversion or account linking.`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to create person', { error, personData });
      throw new HulyError('PERSON_CREATION_FAILED', `Failed to create person: ${error.message}`);
    }
  }

  /**
   * Update person information
   * @param {Object} client - Huly client
   * @param {string} personId - Person ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Update result
   */
  async updatePerson(client, personId, updates) {
    try {
      logger.debug('Updating person', { personId, updates });

      // Verify person exists
      const person = await client.findOne(this.Person, { _id: personId });
      if (!person) {
        throw HulyError.notFound('person', personId);
      }

      // Validate updates
      this._validatePersonUpdates(updates);

      // Prepare person updates
      const personUpdates = {};

      // Handle name updates
      if (updates.firstName || updates.lastName) {
        const currentName = person.name || {};
        personUpdates.name = {
          first: updates.firstName || currentName.first || '',
          last: updates.lastName || currentName.last || '',
        };
      }

      // Handle other field updates
      if (updates.city !== undefined) personUpdates.city = updates.city;
      if (updates.country !== undefined) personUpdates.country = updates.country;
      if (updates.phone !== undefined) personUpdates.phone = updates.phone;
      if (updates.birthday !== undefined) personUpdates.birthday = updates.birthday;

      // Apply updates if any
      if (Object.keys(personUpdates).length > 0) {
        await client.updateDoc(this.Person, core.space.Model, personId, personUpdates);
        logger.debug('Updated person', { personId, updates: personUpdates });
      }

      // Handle email updates (requires account linking)
      if (updates.email !== undefined) {
        await this._updatePersonEmail(client, personId, updates.email);
      }

      // Get updated person for response
      const updatedPerson = await client.findOne(this.Person, { _id: personId });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Updated person: ${this._formatPersonDisplayName(updatedPerson)}

**Person ID**: ${personId}
**Updated Fields**: ${Object.keys({ ...personUpdates, ...(updates.email && { email: updates.email }) }).join(', ')}

## Current Information:
${this._formatPersonDetails(updatedPerson)}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to update person', { error, personId, updates });
      throw new HulyError('PERSON_UPDATE_FAILED', `Failed to update person: ${error.message}`);
    }
  }

  /**
   * Find person by email address
   * @param {Object} client - Huly client
   * @param {string} email - Email address
   * @returns {Promise<Object|null>} Person details or null if not found
   */
  async findPersonByEmail(client, email) {
    try {
      logger.debug('Finding person by email', { email });

      // Find account by email first
      const account = await client.findOne(this.Account, { email });
      if (!account) {
        return null;
      }

      // Find PersonAccount linking to this account
      const personAccount = await client.findOne(this.PersonAccount, { account: account._id });
      if (!personAccount) {
        return null;
      }

      // Get the person
      const person = await client.findOne(this.Person, { _id: personAccount.person });
      if (!person) {
        return null;
      }

      return {
        content: [
          {
            type: 'text',
            text: `## Person Found: ${this._formatPersonDisplayName(person)}

**Person ID**: ${person._id}
**Account ID**: ${account._id}
**Email**: ${email}

${this._formatPersonDetails(person)}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to find person by email', { error, email });
      throw new HulyError(
        'PERSON_SEARCH_FAILED',
        `Failed to find person by email: ${error.message}`
      );
    }
  }

  /**
   * Set person avatar
   * @param {Object} client - Huly client
   * @param {string} personId - Person ID
   * @param {Object} avatarData - Avatar data (blob/file info)
   * @returns {Promise<Object>} Avatar update result
   */
  async setPersonAvatar(client, personId, avatarData) {
    try {
      logger.debug('Setting person avatar', { personId, avatarData });

      // Verify person exists
      const person = await client.findOne(this.Person, { _id: personId });
      if (!person) {
        throw HulyError.notFound('person', personId);
      }

      // Validate avatar data
      this._validateAvatarData(avatarData);

      // Note: Avatar handling would typically involve:
      // 1. Uploading the blob to storage
      // 2. Getting the blob reference
      // 3. Updating the person's avatar field
      // For now, we'll implement a basic version

      const avatarRef = avatarData.blobId || avatarData.url || null;

      await client.updateDoc(this.Person, core.space.Model, personId, {
        avatar: avatarRef,
      });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Updated avatar for: ${this._formatPersonDisplayName(person)}

**Person ID**: ${personId}
**Avatar**: ${avatarRef ? 'Set' : 'Removed'}

${avatarRef ? `**Avatar Reference**: ${avatarRef}` : '**Avatar**: Removed'}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to set person avatar', { error, personId, avatarData });
      throw new HulyError('AVATAR_UPDATE_FAILED', `Failed to set person avatar: ${error.message}`);
    }
  }

  /**
   * Convert person to employee
   * @param {Object} client - Huly client
   * @param {string} personId - Person ID
   * @param {Object} employeeData - Additional employee data
   * @returns {Promise<Object>} Conversion result
   */
  async convertToEmployee(client, personId, employeeData = {}) {
    try {
      logger.debug('Converting person to employee', { personId, employeeData });

      // Verify person exists
      const person = await client.findOne(this.Person, { _id: personId });
      if (!person) {
        throw HulyError.notFound('person', personId);
      }

      // Check if already an employee
      const existingEmployee = await client.findOne(this.Employee, { _id: personId });
      if (existingEmployee) {
        throw new HulyError('ALREADY_EMPLOYEE', 'Person is already an employee');
      }

      // Apply Employee mixin to the Person
      await client.createMixin(personId, this.Person, core.space.Model, this.Employee, {
        active: employeeData.active !== false, // Default to true
        position: employeeData.position || '',
        department: employeeData.department || '',
      });

      logger.debug('Applied Employee mixin', { personId });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Converted person to employee: ${this._formatPersonDisplayName(person)}

**Person ID**: ${personId}
**Status**: Now an active employee
${employeeData.position ? `**Position**: ${employeeData.position}\n` : ''}${employeeData.department ? `**Department**: ${employeeData.department}\n` : ''}

🎉 Person has been successfully converted to an employee and can now be managed through employee tools.`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to convert person to employee', { error, personId, employeeData });
      throw new HulyError(
        'EMPLOYEE_CONVERSION_FAILED',
        `Failed to convert person to employee: ${error.message}`
      );
    }
  }

  // Private helper methods

  /**
   * Validate person data
   * @private
   */
  _validatePersonData(personData) {
    if (!personData.firstName || typeof personData.firstName !== 'string') {
      throw new HulyError('INVALID_PERSON_DATA', 'firstName is required and must be a string');
    }

    if (!personData.lastName || typeof personData.lastName !== 'string') {
      throw new HulyError('INVALID_PERSON_DATA', 'lastName is required and must be a string');
    }

    if (personData.email && typeof personData.email !== 'string') {
      throw new HulyError('INVALID_PERSON_DATA', 'email must be a string');
    }

    if (personData.phone && typeof personData.phone !== 'string') {
      throw new HulyError('INVALID_PERSON_DATA', 'phone must be a string');
    }

    if (personData.city && typeof personData.city !== 'string') {
      throw new HulyError('INVALID_PERSON_DATA', 'city must be a string');
    }

    if (personData.country && typeof personData.country !== 'string') {
      throw new HulyError('INVALID_PERSON_DATA', 'country must be a string');
    }
  }

  /**
   * Validate person updates
   * @private
   */
  _validatePersonUpdates(updates) {
    if (updates.firstName && typeof updates.firstName !== 'string') {
      throw new HulyError('INVALID_UPDATE_DATA', 'firstName must be a string');
    }

    if (updates.lastName && typeof updates.lastName !== 'string') {
      throw new HulyError('INVALID_UPDATE_DATA', 'lastName must be a string');
    }

    if (updates.email && typeof updates.email !== 'string') {
      throw new HulyError('INVALID_UPDATE_DATA', 'email must be a string');
    }
  }

  /**
   * Validate avatar data
   * @private
   */
  _validateAvatarData(avatarData) {
    if (!avatarData || typeof avatarData !== 'object') {
      throw new HulyError('INVALID_AVATAR_DATA', 'avatarData must be an object');
    }

    if (!avatarData.blobId && !avatarData.url) {
      throw new HulyError('INVALID_AVATAR_DATA', 'avatarData must contain blobId or url');
    }
  }

  /**
   * Create PersonName object
   * @private
   */
  _createPersonName(personData) {
    return {
      first: personData.firstName || '',
      last: personData.lastName || '',
    };
  }

  /**
   * Format person name for display
   * @private
   */
  _formatPersonName(personData) {
    return `${personData.firstName} ${personData.lastName}`.trim();
  }

  /**
   * Format person display name from person entity
   * @private
   */
  _formatPersonDisplayName(person) {
    if (person.name) {
      return `${person.name.first || ''} ${person.name.last || ''}`.trim();
    }
    return 'Unknown Person';
  }

  /**
   * Format person details for display
   * @private
   */
  _formatPersonDetails(person) {
    const details = [];

    if (person.name) {
      details.push(`**Name**: ${this._formatPersonDisplayName(person)}`);
    }
    if (person.phone) {
      details.push(`**Phone**: ${person.phone}`);
    }
    if (person.city) {
      details.push(`**City**: ${person.city}`);
    }
    if (person.country) {
      details.push(`**Country**: ${person.country}`);
    }
    if (person.birthday) {
      details.push(`**Birthday**: ${person.birthday}`);
    }
    if (person.avatar) {
      details.push(`**Avatar**: Available`);
    }

    return details.join('\n');
  }

  /**
   * Link person to account via email
   * @private
   */
  async _linkPersonToAccount(client, personId, email) {
    try {
      // Find account by email
      const account = await client.findOne(this.Account, { email });
      if (!account) {
        logger.debug('No account found for email, skipping link', { email });
        return;
      }

      // Check if PersonAccount already exists
      const existingLink = await client.findOne(this.PersonAccount, {
        $or: [{ account: account._id }, { person: personId }],
      });

      if (existingLink) {
        logger.debug('Person-Account link already exists', { personId, accountId: account._id });
        return;
      }

      // Create PersonAccount link
      await client.createDoc(this.PersonAccount, core.space.Model, {
        account: account._id,
        person: personId,
      });

      logger.debug('Linked person to account', { personId, accountId: account._id, email });
    } catch (error) {
      logger.warn('Failed to link person to account', { error, personId, email });
      throw error;
    }
  }

  /**
   * Update person email (requires account management)
   * @private
   */
  async _updatePersonEmail(client, personId, newEmail) {
    try {
      // Remove existing PersonAccount link if it exists
      const existingLink = await client.findOne(this.PersonAccount, { person: personId });
      if (existingLink) {
        await client.removeDoc(this.PersonAccount, core.space.Model, existingLink._id);
      }

      // Create new link if email provided
      if (newEmail) {
        await this._linkPersonToAccount(client, personId, newEmail);
      }

      logger.debug('Updated person email', { personId, newEmail });
    } catch (error) {
      logger.warn('Failed to update person email', { error, personId, newEmail });
      throw error;
    }
  }
}

// Create singleton instance
export const personService = new PersonService();
