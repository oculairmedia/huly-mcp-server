/**
 * Unit tests for IssueService with SequenceService integration
 * Tests that IssueService properly uses SequenceService for atomic number generation
 */

import { jest } from '@jest/globals';
import { IssueService } from '../../../src/services/IssueService.js';

// Mock logger
const _mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock status manager
const mockStatusManager = {
  getDefaultStatus: jest.fn(),
  normalizeStatus: jest.fn(),
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
      IssueStatus: 'tracker:class:IssueStatus',
    },
  },
}));

jest.mock('@hcengineering/chunter', () => ({
  default: {
    class: {
      Comment: 'chunter:class:Comment',
    },
  },
}));

jest.mock('@hcengineering/activity', () => ({
  default: {
    class: {
      DocUpdateMessage: 'activity:class:DocUpdateMessage',
    },
  },
}));

describe('IssueService with SequenceService Tests', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IssueService(mockStatusManager, mockSequenceService);
    mockClient = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      createDoc: jest.fn(),
      updateDoc: jest.fn(),
      uploadMarkup: jest.fn(),
      addCollection: jest.fn(),
    };
  });

  describe('createIssue with SequenceService', () => {
    const mockProject = {
      _id: 'test-project-id',
      identifier: 'TEST',
      name: 'Test Project',
      space: 'test-space',
    };

    const mockStatus = {
      _id: 'status-backlog',
      name: 'Backlog',
      category: 'status:category:Backlog',
    };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((className, _query) => {
        if (className === 'tracker:class:Project') {
          return Promise.resolve(mockProject);
        }
        return Promise.resolve(null);
      });

      mockClient.findAll.mockResolvedValue([mockStatus]);
      mockStatusManager.getDefaultStatus.mockResolvedValue(mockStatus);
      mockClient.createDoc.mockResolvedValue('new-issue-id');
      mockClient.uploadMarkup.mockResolvedValue('desc-ref');
      mockClient.addCollection.mockResolvedValue('new-issue-id');
    });

    it('should use SequenceService to generate issue number', async () => {
      mockSequenceService.getNextIssueNumber.mockResolvedValue(42);

      const result = await service.createIssue(
        mockClient,
        'TEST',
        'Test Issue',
        'Test description',
        'medium'
      );

      // Verify SequenceService was called
      expect(mockSequenceService.getNextIssueNumber).toHaveBeenCalledWith(
        mockClient,
        'test-project-id'
      );

      // Verify issue was created with correct identifier
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(), // space
        expect.anything(), // attachedTo
        expect.anything(), // attachedToClass
        expect.anything(), // collection
        expect.objectContaining({
          number: 42,
          identifier: 'TEST-42',
        })
      );

      expect(result.content[0].text).toContain('Created issue TEST-42');
    });

    it('should handle concurrent issue creation without duplicates', async () => {
      // Simulate different numbers for concurrent calls
      let callCount = 0;
      mockSequenceService.getNextIssueNumber.mockImplementation(() => {
        callCount++;
        return Promise.resolve(100 + callCount);
      });

      // Create multiple issues concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          service.createIssue(
            mockClient,
            'TEST',
            `Concurrent Issue ${i + 1}`,
            'Test description',
            'medium'
          )
        );
      }

      const results = await Promise.all(promises);
      const identifiers = results.map((r) => {
        const match = r.content[0].text.match(/TEST-(\d+)/);
        return match ? parseInt(match[1]) : null;
      });

      // Verify all issue numbers are unique
      const uniqueNumbers = new Set(identifiers);
      expect(uniqueNumbers.size).toBe(5);

      // Verify SequenceService was called 5 times
      expect(mockSequenceService.getNextIssueNumber).toHaveBeenCalledTimes(5);
    });

    it('should fall back to old method if SequenceService not available', async () => {
      // Create service without SequenceService
      const serviceWithoutSequence = new IssueService(mockStatusManager, null);

      // Mock finding last issue
      mockClient.findOne.mockImplementation((className, query, options) => {
        if (className === 'tracker:class:Project') {
          return Promise.resolve(mockProject);
        }
        if (className === 'tracker:class:Issue' && options?.sort) {
          return Promise.resolve({ number: 10, identifier: 'TEST-10' });
        }
        return Promise.resolve(null);
      });

      const _result = await serviceWithoutSequence.createIssue(
        mockClient,
        'TEST',
        'Test Issue',
        'Test description',
        'medium'
      );

      // Verify it used the old method
      expect(mockClient.findOne).toHaveBeenCalledWith(
        'tracker:class:Issue',
        { space: 'test-project-id' },
        { sort: { number: -1 } }
      );

      // Verify issue was created with next number (11)
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(), // space
        expect.anything(), // attachedTo
        expect.anything(), // attachedToClass
        expect.anything(), // collection
        expect.objectContaining({
          number: 11,
          identifier: 'TEST-11',
        })
      );
    });

    it('should handle SequenceService errors gracefully', async () => {
      mockSequenceService.getNextIssueNumber.mockRejectedValue(
        new Error('Sequence generation failed')
      );

      await expect(
        service.createIssue(mockClient, 'TEST', 'Test Issue', 'Test description', 'medium')
      ).rejects.toThrow('Sequence generation failed');
    });
  });

  describe('createSubissue with SequenceService', () => {
    const mockParentIssue = {
      _id: 'parent-issue-id',
      identifier: 'TEST-1',
      space: 'test-project-id',
      subIssues: [],
    };

    const mockProject = {
      _id: 'test-project-id',
      identifier: 'TEST',
      name: 'Test Project',
      space: 'test-space',
    };

    const mockStatus = {
      _id: 'status-backlog',
      name: 'Backlog',
      category: 'status:category:Backlog',
    };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((className, _query) => {
        if (className === 'tracker:class:Issue' && _query.identifier === 'TEST-1') {
          return Promise.resolve(mockParentIssue);
        }
        if (className === 'tracker:class:Project') {
          return Promise.resolve(mockProject);
        }
        return Promise.resolve(null);
      });

      mockClient.findAll.mockResolvedValue([mockStatus]);
      mockStatusManager.getDefaultStatus.mockResolvedValue(mockStatus);
      mockClient.createDoc.mockResolvedValue('new-subissue-id');
      mockClient.uploadMarkup.mockResolvedValue('desc-ref');
      mockClient.updateDoc.mockResolvedValue();
      mockClient.addCollection.mockResolvedValue('new-subissue-id');
    });

    it('should use SequenceService for subissue number generation', async () => {
      mockSequenceService.getNextIssueNumber.mockResolvedValue(55);

      const result = await service.createSubissue(
        mockClient,
        'TEST-1',
        'Test Subissue',
        'Subissue description',
        'high'
      );

      // Verify SequenceService was called
      expect(mockSequenceService.getNextIssueNumber).toHaveBeenCalledWith(
        mockClient,
        'test-project-id'
      );

      // Verify subissue was created with correct number
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(), // space
        expect.anything(), // parentIssue._id
        expect.anything(), // attachedToClass
        expect.anything(), // collection
        expect.objectContaining({
          number: 55,
          identifier: 'TEST-55',
          attachedTo: 'parent-issue-id',
        })
      );

      expect(result.content[0].text).toContain('Created subissue TEST-55');
      expect(result.content[0].text).toContain('Parent: TEST-1');
    });
  });
});
