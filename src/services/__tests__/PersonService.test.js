/**
 * Unit tests for PersonService
 */

import { jest } from '@jest/globals';
import { PersonService } from '../PersonService.js';
import { HulyError } from '../../core/HulyError.js';

// Mock Huly modules
jest.mock('@hcengineering/contact', () => ({
  contactPlugin: {
    class: {
      PersonAccount: 'contact:class:PersonAccount',
      Person: 'contact:class:Person',
      Contact: 'contact:class:Contact',
    },
    mixin: {
      Employee: 'contact:mixin:Employee',
    },
  },
}));

jest.mock('@hcengineering/core', () => ({
  default: {
    class: {
      Account: 'core:class:Account',
    },
    space: {
      Model: 'core:space:Model',
    },
  },
}));

jest.mock('../../utils/Logger.js', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('PersonService', () => {
  let personService;
  let mockClient;

  beforeEach(() => {
    personService = new PersonService();
    mockClient = {
      createDoc: jest.fn(),
      updateDoc: jest.fn(),
      removeDoc: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      createMixin: jest.fn(),
    };
  });

  describe('createPerson', () => {
    it('should create a person successfully', async () => {
      const personData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        city: 'New York',
        country: 'USA',
      };

      const mockPersonId = 'person-123';
      mockClient.createDoc.mockResolvedValue(mockPersonId);
      mockClient.findOne.mockResolvedValueOnce(null); // No existing person with email
      mockClient.findOne.mockResolvedValueOnce({
        _id: mockPersonId,
        name: { first: 'John', last: 'Doe' },
      }); // Created person
      mockClient.findOne.mockResolvedValueOnce({
        _id: 'account-123',
        email: 'john.doe@example.com',
      }); // Account exists

      const result = await personService.createPerson(mockClient, personData);

      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'contact:class:Person',
        'core:space:Model',
        {
          name: { first: 'John', last: 'Doe' },
          city: 'New York',
          country: 'USA',
          phone: '+1234567890',
          birthday: null,
          avatar: null,
        }
      );
      expect(result.content[0].text).toContain('✅ Created person: John Doe');
      expect(result.content[0].text).toContain('**Person ID**: person-123');
    });

    it('should throw error if person with email already exists', async () => {
      const personData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      };

      // Mock that findPersonByEmail returns an existing person
      const existingPersonResponse = {
        content: [{ type: 'text', text: 'Person Found: John Doe' }],
      };
      jest.spyOn(personService, 'findPersonByEmail').mockResolvedValue(existingPersonResponse);

      await expect(personService.createPerson(mockClient, personData)).rejects.toThrow(
        'Failed to create person: Person with email john.doe@example.com already exists'
      );
    });

    it('should validate required fields', async () => {
      const invalidData = { firstName: 'John' }; // Missing lastName

      await expect(personService.createPerson(mockClient, invalidData)).rejects.toThrow(
        'Failed to create person: lastName is required and must be a string'
      );
    });

    it('should handle creation without email', async () => {
      const personData = {
        firstName: 'John',
        lastName: 'Doe',
        city: 'New York',
      };

      const mockPersonId = 'person-123';
      mockClient.createDoc.mockResolvedValue(mockPersonId);
      mockClient.findOne.mockResolvedValue({
        _id: mockPersonId,
        name: { first: 'John', last: 'Doe' },
      });

      const result = await personService.createPerson(mockClient, personData);

      expect(result.content[0].text).toContain('✅ Created person: John Doe');
      expect(result.content[0].text).not.toContain('Email:');
    });
  });

  describe('updatePerson', () => {
    it('should update person successfully', async () => {
      const personId = 'person-123';
      const updates = {
        firstName: 'Jane',
        city: 'Los Angeles',
        phone: '+9876543210',
      };

      const mockPerson = {
        _id: personId,
        name: { first: 'John', last: 'Doe' },
        city: 'New York',
        phone: '+1234567890',
      };

      const mockUpdatedPerson = {
        ...mockPerson,
        name: { first: 'Jane', last: 'Doe' },
        city: 'Los Angeles',
        phone: '+9876543210',
      };

      mockClient.findOne.mockResolvedValueOnce(mockPerson); // Initial person lookup
      mockClient.findOne.mockResolvedValueOnce(mockUpdatedPerson); // Updated person lookup

      const result = await personService.updatePerson(mockClient, personId, updates);

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'contact:class:Person',
        'core:space:Model',
        personId,
        {
          name: { first: 'Jane', last: 'Doe' },
          city: 'Los Angeles',
          phone: '+9876543210',
        }
      );
      expect(result.content[0].text).toContain('✅ Updated person: Jane Doe');
    });

    it('should throw error if person not found', async () => {
      const personId = 'person-123';
      const updates = { firstName: 'Jane' };

      mockClient.findOne.mockResolvedValue(null);

      await expect(personService.updatePerson(mockClient, personId, updates)).rejects.toThrow(
        'Failed to update person: person person-123 not found'
      );
    });

    it('should handle name updates correctly', async () => {
      const personId = 'person-123';
      const updates = { lastName: 'Smith' };

      const mockPerson = {
        _id: personId,
        name: { first: 'John', last: 'Doe' },
      };

      mockClient.findOne.mockResolvedValueOnce(mockPerson);
      mockClient.findOne.mockResolvedValueOnce(mockPerson);

      await personService.updatePerson(mockClient, personId, updates);

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'contact:class:Person',
        'core:space:Model',
        personId,
        {
          name: { first: 'John', last: 'Smith' },
        }
      );
    });
  });

  describe('findPersonByEmail', () => {
    it('should find person by email successfully', async () => {
      const email = 'john.doe@example.com';
      const mockAccount = { _id: 'account-123', email };
      const mockPersonAccount = { account: 'account-123', person: 'person-123' };
      const mockPerson = {
        _id: 'person-123',
        name: { first: 'John', last: 'Doe' },
        city: 'New York',
      };

      mockClient.findOne
        .mockResolvedValueOnce(mockAccount) // Account lookup
        .mockResolvedValueOnce(mockPersonAccount) // PersonAccount lookup
        .mockResolvedValueOnce(mockPerson); // Person lookup

      const result = await personService.findPersonByEmail(mockClient, email);

      expect(result.content[0].text).toContain('## Person Found: John Doe');
      expect(result.content[0].text).toContain('**Person ID**: person-123');
      expect(result.content[0].text).toContain('**Email**: john.doe@example.com');
    });

    it('should return null if account not found', async () => {
      const email = 'nonexistent@example.com';
      mockClient.findOne.mockResolvedValue(null);

      const result = await personService.findPersonByEmail(mockClient, email);

      expect(result).toBeNull();
    });

    it('should return null if PersonAccount not found', async () => {
      const email = 'john.doe@example.com';
      const mockAccount = { _id: 'account-123', email };

      mockClient.findOne
        .mockResolvedValueOnce(mockAccount) // Account found
        .mockResolvedValueOnce(null); // PersonAccount not found

      const result = await personService.findPersonByEmail(mockClient, email);

      expect(result).toBeNull();
    });
  });

  describe('setPersonAvatar', () => {
    it('should set person avatar successfully', async () => {
      const personId = 'person-123';
      const avatarData = { blobId: 'blob-123' };
      const mockPerson = {
        _id: personId,
        name: { first: 'John', last: 'Doe' },
      };

      mockClient.findOne.mockResolvedValue(mockPerson);

      const result = await personService.setPersonAvatar(mockClient, personId, avatarData);

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'contact:class:Person',
        'core:space:Model',
        personId,
        { avatar: 'blob-123' }
      );
      expect(result.content[0].text).toContain('✅ Updated avatar for: John Doe');
    });

    it('should throw error if person not found', async () => {
      const personId = 'person-123';
      const avatarData = { blobId: 'blob-123' };

      mockClient.findOne.mockResolvedValue(null);

      await expect(personService.setPersonAvatar(mockClient, personId, avatarData)).rejects.toThrow(
        'Failed to set person avatar: person person-123 not found'
      );
    });

    it('should validate avatar data', async () => {
      const personId = 'person-123';
      const invalidAvatarData = {}; // Missing blobId or url

      const mockPerson = { _id: personId, name: { first: 'John', last: 'Doe' } };
      mockClient.findOne.mockResolvedValue(mockPerson);

      await expect(
        personService.setPersonAvatar(mockClient, personId, invalidAvatarData)
      ).rejects.toThrow('Failed to set person avatar: avatarData must contain blobId or url');
    });
  });

  describe('convertToEmployee', () => {
    it('should convert person to employee successfully', async () => {
      const personId = 'person-123';
      const employeeData = {
        position: 'Developer',
        department: 'Engineering',
        active: true,
      };

      const mockPerson = {
        _id: personId,
        name: { first: 'John', last: 'Doe' },
      };

      mockClient.findOne
        .mockResolvedValueOnce(mockPerson) // Person exists
        .mockResolvedValueOnce(null); // Not already an employee

      const result = await personService.convertToEmployee(mockClient, personId, employeeData);

      expect(mockClient.createMixin).toHaveBeenCalledWith(
        personId,
        'contact:class:Person',
        'core:space:Model',
        'contact:mixin:Employee',
        {
          active: true,
          position: 'Developer',
          department: 'Engineering',
        }
      );
      expect(result.content[0].text).toContain('✅ Converted person to employee: John Doe');
    });

    it('should throw error if person not found', async () => {
      const personId = 'person-123';
      mockClient.findOne.mockResolvedValue(null);

      await expect(personService.convertToEmployee(mockClient, personId)).rejects.toThrow(
        'Failed to convert person to employee: person person-123 not found'
      );
    });

    it('should throw error if already an employee', async () => {
      const personId = 'person-123';
      const mockPerson = { _id: personId, name: { first: 'John', last: 'Doe' } };
      const mockEmployee = { _id: personId, active: true };

      mockClient.findOne
        .mockResolvedValueOnce(mockPerson) // Person exists
        .mockResolvedValueOnce(mockEmployee); // Already an employee

      await expect(personService.convertToEmployee(mockClient, personId)).rejects.toThrow(
        'Failed to convert person to employee: Person is already an employee'
      );
    });
  });

  describe('validation methods', () => {
    it('should validate person data correctly', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      expect(() => personService._validatePersonData(validData)).not.toThrow();
    });

    it('should throw error for invalid person data', () => {
      const invalidData = { firstName: 'John' }; // Missing lastName

      expect(() => personService._validatePersonData(invalidData)).toThrow(
        new HulyError('INVALID_PERSON_DATA', 'lastName is required and must be a string')
      );
    });

    it('should validate person updates correctly', () => {
      const validUpdates = {
        firstName: 'Jane',
        email: 'jane@example.com',
      };

      expect(() => personService._validatePersonUpdates(validUpdates)).not.toThrow();
    });

    it('should throw error for invalid update data', () => {
      const invalidUpdates = { firstName: 123 }; // Should be string

      expect(() => personService._validatePersonUpdates(invalidUpdates)).toThrow(
        new HulyError('INVALID_UPDATE_DATA', 'firstName must be a string')
      );
    });
  });

  describe('helper methods', () => {
    it('should create person name correctly', () => {
      const personData = { firstName: 'John', lastName: 'Doe' };
      const result = personService._createPersonName(personData);

      expect(result).toEqual({ first: 'John', last: 'Doe' });
    });

    it('should format person name correctly', () => {
      const personData = { firstName: 'John', lastName: 'Doe' };
      const result = personService._formatPersonName(personData);

      expect(result).toBe('John Doe');
    });

    it('should format person display name correctly', () => {
      const person = { name: { first: 'John', last: 'Doe' } };
      const result = personService._formatPersonDisplayName(person);

      expect(result).toBe('John Doe');
    });

    it('should format person details correctly', () => {
      const person = {
        name: { first: 'John', last: 'Doe' },
        phone: '+1234567890',
        city: 'New York',
        country: 'USA',
      };
      const result = personService._formatPersonDetails(person);

      expect(result).toContain('**Name**: John Doe');
      expect(result).toContain('**Phone**: +1234567890');
      expect(result).toContain('**City**: New York');
      expect(result).toContain('**Country**: USA');
    });
  });

  describe('error handling', () => {
    it('should handle createPerson errors gracefully', async () => {
      const personData = {
        firstName: 'John',
        lastName: 'Doe',
      };

      mockClient.createDoc.mockRejectedValue(new Error('Database error'));

      await expect(personService.createPerson(mockClient, personData)).rejects.toThrow(
        new HulyError('PERSON_CREATION_FAILED', 'Failed to create person: Database error')
      );
    });

    it('should handle updatePerson errors gracefully', async () => {
      const personId = 'person-123';
      const updates = { firstName: 'Jane' };

      mockClient.findOne.mockResolvedValue({ _id: personId, name: { first: 'John', last: 'Doe' } });
      mockClient.updateDoc.mockRejectedValue(new Error('Update failed'));

      await expect(personService.updatePerson(mockClient, personId, updates)).rejects.toThrow(
        new HulyError('PERSON_UPDATE_FAILED', 'Failed to update person: Update failed')
      );
    });

    it('should handle findPersonByEmail errors gracefully', async () => {
      const email = 'john.doe@example.com';
      mockClient.findOne.mockRejectedValue(new Error('Database error'));

      await expect(personService.findPersonByEmail(mockClient, email)).rejects.toThrow(
        new HulyError('PERSON_SEARCH_FAILED', 'Failed to find person by email: Database error')
      );
    });
  });
});
