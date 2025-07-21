/**
 * Unit tests for TemplateService with SequenceService integration
 * Tests that TemplateService properly uses SequenceService for atomic number generation
 */

import { jest } from '@jest/globals';
import TemplateService from '../../../src/services/TemplateService.js';

// Mock logger
const _mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock sequence service
const mockSequenceService = {
  getNextIssueNumber: jest.fn(),
};

// Mock Huly modules
jest.mock('@hcengineering/tracker', () => ({
  default: {
    class: {
      Project: 'tracker:class:Project',
      Issue: 'tracker:class:Issue',
      IssueTemplate: 'tracker:class:IssueTemplate',
      IssueStatus: 'tracker:class:IssueStatus',
    },
    ids: {
      NoParent: 'tracker:ids:NoParent',
    },
  },
}));

jest.mock('@hcengineering/core', () => ({
  default: {
    class: {
      Account: 'core:class:Account',
    },
  },
  generateId: jest.fn(() => 'generated-id'),
}));

describe('TemplateService with SequenceService Tests', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TemplateService(mockSequenceService);
    mockClient = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      createDoc: jest.fn(),
      addCollection: jest.fn(),
      updateDoc: jest.fn(),
    };
  });

  describe('createIssueFromTemplate with SequenceService', () => {
    const mockProject = {
      _id: 'test-project-id',
      identifier: 'TEST',
      name: 'Test Project',
      defaultIssueStatus: 'status-backlog',
    };

    const mockTemplate = {
      _id: 'template-id',
      space: 'test-project-id',
      title: 'Template Issue',
      description: 'Template description',
      priority: 2,
      assignee: null,
      component: null,
      milestone: null,
      estimation: 0,
      children: [
        {
          title: 'Child Issue 1',
          description: 'Child 1 desc',
          priority: 1,
          assignee: null,
          component: null,
          milestone: null,
          estimation: 0,
        },
        {
          title: 'Child Issue 2',
          description: 'Child 2 desc',
          priority: 2,
          assignee: null,
          component: null,
          milestone: null,
          estimation: 0,
        },
      ],
    };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((className, query) => {
        if (className === 'tracker:class:IssueTemplate' && query._id === 'template-id') {
          return Promise.resolve(mockTemplate);
        }
        if (className === 'tracker:class:Project') {
          return Promise.resolve(mockProject);
        }
        return Promise.resolve(null);
      });

      mockClient.addCollection.mockResolvedValue('new-issue-id');
    });

    it('should use SequenceService to generate issue numbers', async () => {
      // Mock sequence numbers for main issue and children
      mockSequenceService.getNextIssueNumber
        .mockResolvedValueOnce(100) // Main issue
        .mockResolvedValueOnce(101) // Child 1
        .mockResolvedValueOnce(102); // Child 2

      const result = await service.createIssueFromTemplate(mockClient, 'template-id');

      // Verify SequenceService was called 3 times (main + 2 children)
      expect(mockSequenceService.getNextIssueNumber).toHaveBeenCalledTimes(3);
      expect(mockSequenceService.getNextIssueNumber).toHaveBeenCalledWith(
        mockClient,
        'test-project-id'
      );

      // Verify main issue created with correct number
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        'test-project-id',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          number: 100,
          identifier: 'TEST-100',
        })
      );

      // Verify result contains all created issues
      expect(result.content[0].text).toContain('Created 3 issue(s) from template');
      expect(result.content[0].text).toContain('TEST-100');
      expect(result.content[0].text).toContain('TEST-101');
      expect(result.content[0].text).toContain('TEST-102');
    });

    it('should handle concurrent template creation without duplicates', async () => {
      // Simulate different numbers for concurrent calls
      let callCount = 0;
      mockSequenceService.getNextIssueNumber.mockImplementation(() => {
        callCount++;
        return Promise.resolve(200 + callCount);
      });

      // Create multiple issues from template concurrently
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          service.createIssueFromTemplate(mockClient, 'template-id', {
            includeChildren: false, // Only create main issue for simplicity
          })
        );
      }

      const results = await Promise.all(promises);
      const identifiers = results.map((r) => {
        const match = r.content[0].text.match(/TEST-(\d+)/);
        return match ? `TEST-${match[1]}` : null;
      });

      // Verify all identifiers are unique
      const uniqueIdentifiers = new Set(identifiers);
      expect(uniqueIdentifiers.size).toBe(3);
      expect(identifiers).toEqual(['TEST-201', 'TEST-202', 'TEST-203']);
    });

    it('should fall back to old method if SequenceService not available', async () => {
      // Create service without SequenceService
      const serviceWithoutSequence = new TemplateService(null);

      // Mock finding last issue
      mockClient.findOne.mockImplementation((className, query, options) => {
        if (className === 'tracker:class:IssueTemplate' && query._id === 'template-id') {
          return Promise.resolve(mockTemplate);
        }
        if (className === 'tracker:class:Project') {
          return Promise.resolve(mockProject);
        }
        if (className === 'tracker:class:Issue' && options?.sort) {
          return Promise.resolve({ number: 50, identifier: 'TEST-50' });
        }
        return Promise.resolve(null);
      });

      const _result = await serviceWithoutSequence.createIssueFromTemplate(
        mockClient,
        'template-id',
        {
          includeChildren: false,
        }
      );

      // Verify it used the old method
      expect(mockClient.findOne).toHaveBeenCalledWith(
        'tracker:class:Issue',
        { space: 'test-project-id' },
        { sort: { number: -1 } }
      );

      // Verify issue was created with next number (51)
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        'test-project-id',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          number: 51,
          identifier: 'TEST-51',
        })
      );
    });

    it('should handle SequenceService errors gracefully', async () => {
      mockSequenceService.getNextIssueNumber.mockRejectedValue(
        new Error('Sequence generation failed')
      );

      await expect(service.createIssueFromTemplate(mockClient, 'template-id')).rejects.toThrow(
        'Sequence generation failed'
      );
    });

    it('should properly sequence numbers for parent and children', async () => {
      // Mock sequential numbers
      mockSequenceService.getNextIssueNumber
        .mockResolvedValueOnce(300) // Main issue
        .mockResolvedValueOnce(301) // Child 1
        .mockResolvedValueOnce(302); // Child 2

      await service.createIssueFromTemplate(mockClient, 'template-id');

      // Verify parent-child relationships
      const addCollectionCalls = mockClient.addCollection.mock.calls;

      // Main issue should have no parent
      expect(addCollectionCalls[0][2]).toBe('tracker:ids:NoParent');
      expect(addCollectionCalls[0][5].number).toBe(300);

      // Children should reference parent
      expect(addCollectionCalls[1][2]).toBe('new-issue-id'); // Parent ID
      expect(addCollectionCalls[1][5].number).toBe(301);

      expect(addCollectionCalls[2][2]).toBe('new-issue-id'); // Parent ID
      expect(addCollectionCalls[2][5].number).toBe(302);
    });
  });
});
