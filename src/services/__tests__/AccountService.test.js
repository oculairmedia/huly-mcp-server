/**
 * Unit tests for AccountService
 */

import { jest } from '@jest/globals';
import { AccountService } from '../AccountService.js';
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

describe('AccountService', () => {
  let accountService;
  let mockClient;

  beforeEach(() => {
    accountService = new AccountService();
    mockClient = {
      getCurrentAccountId: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      createDoc: jest.fn(),
      updateDoc: jest.fn(),
      accountId: 'test-account-id',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentAccount', () => {
    it('should get current account successfully', async () => {
      const mockAccount = {
        _id: 'test-account-id',
        email: 'test@example.com',
        first: 'John',
        last: 'Doe',
        role: 'user',
        confirmed: true,
      };

      mockClient.findOne.mockResolvedValueOnce(mockAccount);

      const result = await accountService.getCurrentAccount(mockClient);

      expect(mockClient.findOne).toHaveBeenCalledWith('core:class:Account', {
        _id: 'test-account-id',
      });
      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain('test@example.com');
      expect(result.content[0].text).toContain('John Doe');
    });

    it('should handle account not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(accountService.getCurrentAccount(mockClient)).rejects.toThrow(HulyError);
    });

    it('should handle no current account ID', async () => {
      mockClient.getCurrentAccountId = jest.fn().mockReturnValue(null);
      mockClient.accountId = null;

      await expect(accountService.getCurrentAccount(mockClient)).rejects.toThrow(
        'No current account found in session'
      );
    });
  });

  describe('createAccount', () => {
    const validAccountData = {
      email: 'new@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'user',
      confirmed: false,
    };

    it('should create account successfully', async () => {
      mockClient.findOne.mockResolvedValueOnce(null); // No existing account
      mockClient.createDoc.mockResolvedValueOnce('new-account-id');

      const result = await accountService.createAccount(mockClient, validAccountData);

      expect(mockClient.findOne).toHaveBeenCalledWith('core:class:Account', {
        email: 'new@example.com',
      });
      expect(mockClient.createDoc).toHaveBeenCalledWith('core:class:Account', 'core:space:Model', {
        email: 'new@example.com',
        first: 'Jane',
        last: 'Smith',
        role: 'user',
        confirmed: false,
      });
      expect(result.content[0].text).toContain('new@example.com');
      expect(result.content[0].text).toContain('new-account-id');
    });

    it('should validate required fields', async () => {
      const invalidData = { firstName: 'Jane' }; // Missing email

      await expect(accountService.createAccount(mockClient, invalidData)).rejects.toThrow(
        'Email is required'
      );
    });

    it('should validate email format', async () => {
      const invalidData = { email: 'invalid-email', firstName: 'Jane' };

      await expect(accountService.createAccount(mockClient, invalidData)).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should check for existing account', async () => {
      const existingAccount = { _id: 'existing-id', email: 'new@example.com' };
      mockClient.findOne.mockResolvedValueOnce(existingAccount);

      await expect(accountService.createAccount(mockClient, validAccountData)).rejects.toThrow(
        'Account with email new@example.com already exists'
      );
    });

    it('should validate role', async () => {
      const invalidData = { ...validAccountData, role: 'invalid-role' };

      await expect(accountService.createAccount(mockClient, invalidData)).rejects.toThrow(
        'Invalid role'
      );
    });
  });

  describe('updateAccountSettings', () => {
    const accountId = 'test-account-id';
    const mockAccount = {
      _id: accountId,
      email: 'test@example.com',
      first: 'John',
      last: 'Doe',
    };

    it('should update account settings successfully', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockAccount);
      mockClient.updateDoc.mockResolvedValueOnce(undefined);

      const settings = {
        firstName: 'Johnny',
        email: 'johnny@example.com',
        timezone: 'UTC',
      };

      const result = await accountService.updateAccountSettings(mockClient, accountId, settings);

      expect(mockClient.findOne).toHaveBeenCalledWith('core:class:Account', { _id: accountId });
      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'core:class:Account',
        'core:space:Model',
        accountId,
        {
          first: 'Johnny',
          email: 'johnny@example.com',
          timezone: 'UTC',
        }
      );
      expect(result.content[0].text).toContain('Updated fields: first, email, timezone');
    });

    it('should validate email format in updates', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockAccount);

      const settings = { email: 'invalid-email' };

      await expect(
        accountService.updateAccountSettings(mockClient, accountId, settings)
      ).rejects.toThrow('Invalid email format');
    });

    it('should handle account not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      const settings = { firstName: 'Johnny' };

      await expect(
        accountService.updateAccountSettings(mockClient, accountId, settings)
      ).rejects.toThrow(HulyError);
    });
  });

  describe('listWorkspaceMembers', () => {
    const mockAccounts = [
      {
        _id: 'account-1',
        email: 'user1@example.com',
        first: 'John',
        last: 'Doe',
        role: 'user',
        confirmed: true,
      },
      {
        _id: 'account-2',
        email: 'admin@example.com',
        first: 'Jane',
        last: 'Admin',
        role: 'admin',
        confirmed: true,
      },
    ];

    it('should list workspace members successfully', async () => {
      mockClient.findAll.mockResolvedValueOnce(mockAccounts);
      // Mock findOne calls for PersonAccount lookups (return null for simplicity)
      mockClient.findOne.mockResolvedValue(null);

      const result = await accountService.listWorkspaceMembers(mockClient);

      expect(mockClient.findAll).toHaveBeenCalledWith('core:class:Account', {}, { limit: 50 });
      expect(result.content[0].text).toContain('Found 2 workspace members');
      expect(result.content[0].text).toContain('user1@example.com');
      expect(result.content[0].text).toContain('admin@example.com');
    });

    it('should filter by role', async () => {
      const adminAccounts = [mockAccounts[1]];
      mockClient.findAll.mockResolvedValueOnce(adminAccounts);
      mockClient.findOne.mockResolvedValue(null);

      const result = await accountService.listWorkspaceMembers(mockClient, null, { role: 'admin' });

      expect(mockClient.findAll).toHaveBeenCalledWith(
        'core:class:Account',
        { role: 'admin' },
        { limit: 50 }
      );
      expect(result.content[0].text).toContain('Found 1 workspace members');
    });

    it('should include person details when available', async () => {
      mockClient.findAll.mockResolvedValueOnce([mockAccounts[0]]);

      const mockPersonAccount = { account: 'account-1', person: 'person-1' };
      const mockPerson = {
        _id: 'person-1',
        name: { first: 'John', last: 'Doe' },
        city: 'New York',
        country: 'USA',
        phone: '+1234567890',
      };

      mockClient.findOne
        .mockResolvedValueOnce(mockPersonAccount) // PersonAccount lookup
        .mockResolvedValueOnce(mockPerson) // Person lookup
        .mockResolvedValueOnce(null); // Employee lookup

      const result = await accountService.listWorkspaceMembers(mockClient);

      expect(result.content[0].text).toContain('John Doe');
    });
  });

  describe('getAccountByEmail', () => {
    it('should get account by email successfully', async () => {
      const mockAccount = {
        _id: 'test-account-id',
        email: 'test@example.com',
        first: 'John',
        last: 'Doe',
        role: 'user',
        confirmed: true,
      };

      mockClient.findOne.mockResolvedValueOnce(mockAccount);

      const result = await accountService.getAccountByEmail(mockClient, 'test@example.com');

      expect(mockClient.findOne).toHaveBeenCalledWith('core:class:Account', {
        email: 'test@example.com',
      });
      expect(result.content[0].text).toContain('test@example.com');
      expect(result.content[0].text).toContain('John Doe');
    });

    it('should handle account not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        accountService.getAccountByEmail(mockClient, 'notfound@example.com')
      ).rejects.toThrow(HulyError);
    });
  });

  describe('validation methods', () => {
    it('should validate account data correctly', () => {
      // Valid data should not throw
      expect(() => {
        accountService._validateAccountData({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'user',
        });
      }).not.toThrow();

      // Invalid email should throw
      expect(() => {
        accountService._validateAccountData({ email: 'invalid' });
      }).toThrow('Invalid email format');

      // Missing email should throw
      expect(() => {
        accountService._validateAccountData({ firstName: 'John' });
      }).toThrow('Email is required');

      // Invalid role should throw
      expect(() => {
        accountService._validateAccountData({ email: 'test@example.com', role: 'invalid' });
      }).toThrow('Invalid role');
    });
  });

  describe('formatting methods', () => {
    it('should format account details correctly', () => {
      const account = {
        _id: 'test-id',
        email: 'test@example.com',
        first: 'John',
        last: 'Doe',
        role: 'user',
        confirmed: true,
      };

      const result = accountService._formatAccountDetails(account);

      expect(result.content[0].text).toContain('Account: test@example.com');
      expect(result.content[0].text).toContain('**Account ID**: test-id');
      expect(result.content[0].text).toContain('**Name**: John Doe');
      expect(result.content[0].text).toContain('**Role**: user');
      expect(result.content[0].text).toContain('**Confirmed**: Yes');
    });

    it('should format person info correctly', () => {
      const person = {
        _id: 'person-id',
        name: { first: 'John', last: 'Doe' },
        city: 'New York',
        country: 'USA',
        phone: '+1234567890',
      };

      const result = accountService._formatPersonInfo(person);

      expect(result.id).toBe('person-id');
      expect(result.fullName).toBe('John Doe');
      expect(result.location).toBe('New York, USA');
      expect(result.phone).toBe('+1234567890');
    });

    it('should format member summary correctly', () => {
      const account = {
        _id: 'account-1',
        email: 'test@example.com',
        first: 'John',
        last: 'Doe',
        role: 'admin',
        confirmed: true,
      };

      const personInfo = {
        fullName: 'John Doe',
        isEmployee: true,
        employeeActive: true,
        position: 'Developer',
      };

      const result = accountService._formatMemberSummary(account, personInfo);

      expect(result).toContain('👑 **John Doe**');
      expect(result).toContain('test@example.com');
      expect(result).toContain('✅ Confirmed');
      expect(result).toContain('Role: admin');
      expect(result).toContain('👷 Employee: ✅ Active');
      expect(result).toContain('Developer');
    });
  });
});
