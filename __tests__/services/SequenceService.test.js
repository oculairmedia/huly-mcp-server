/**
 * Unit tests for SequenceService
 * Tests atomic sequence generation for issue numbers
 */

import { jest } from '@jest/globals';
import { SequenceService, createSequenceService } from '../../src/services/SequenceService.js';

// Mock the logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Huly modules
jest.mock('@hcengineering/core', () => ({
  default: {
    space: {
      Space: 'core:space:Space',
    },
  },
}));

jest.mock('@hcengineering/tracker', () => ({
  default: {
    class: {
      Project: 'tracker:class:Project',
      Issue: 'tracker:class:Issue',
    },
  },
}));

describe('SequenceService', () => {
  let sequenceService;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    sequenceService = new SequenceService(mockLogger);

    // Create mock client
    mockClient = {
      findOne: jest.fn(),
      updateDoc: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should create instance with logger', () => {
      expect(sequenceService.logger).toBe(mockLogger);
      expect(sequenceService._sequenceCache).toBeInstanceOf(Map);
      expect(sequenceService._cacheTTL).toBe(60000);
    });
  });

  describe('getNextIssueNumber', () => {
    const projectId = 'test-project-id';
    const mockProject = {
      _id: projectId,
      identifier: 'TEST',
      space: 'test-space',
      sequence: 10,
    };

    it('should get next issue number for existing sequence', async () => {
      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.updateDoc.mockResolvedValue({
        object: { ...mockProject, sequence: 11 },
      });

      const result = await sequenceService.getNextIssueNumber(mockClient, projectId);

      expect(result).toBe(11);
      expect(mockClient.findOne).toHaveBeenCalledWith('tracker:class:Project', { _id: projectId });
      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:Project',
        'test-space',
        projectId,
        { $inc: { sequence: 1 } },
        true
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Generated issue number 11 for project TEST');
    });

    it('should initialize sequence for new project', async () => {
      const projectWithoutSequence = { ...mockProject, sequence: undefined };
      mockClient.findOne
        .mockResolvedValueOnce(projectWithoutSequence) // First call
        .mockResolvedValueOnce(null); // For initialization check

      mockClient.updateDoc
        .mockResolvedValueOnce() // Initialize sequence
        .mockResolvedValueOnce({ object: { sequence: 1 } }); // Get next number

      const result = await sequenceService.getNextIssueNumber(mockClient, projectId);

      expect(result).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing sequence for project test-project-id'
      );
    });

    it('should initialize from highest existing issue', async () => {
      const projectWithoutSequence = { ...mockProject, sequence: null };
      const existingIssue = { number: 25 };

      mockClient.findOne
        .mockResolvedValueOnce(projectWithoutSequence)
        .mockResolvedValueOnce(existingIssue); // Highest issue

      mockClient.updateDoc
        .mockResolvedValueOnce() // Set initial sequence
        .mockResolvedValueOnce({ object: { sequence: 26 } });

      const result = await sequenceService.getNextIssueNumber(mockClient, projectId);

      expect(result).toBe(26);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Setting initial sequence to 25 for project test-project-id'
      );
    });

    it('should throw error if project not found', async () => {
      mockClient.findOne.mockResolvedValue(null);

      await expect(sequenceService.getNextIssueNumber(mockClient, projectId)).rejects.toThrow(
        'project test-project-id not found'
      );
    });

    it('should throw error if update returns no sequence', async () => {
      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.updateDoc.mockResolvedValue({ object: {} });

      await expect(sequenceService.getNextIssueNumber(mockClient, projectId)).rejects.toThrow(
        'Failed to get sequence number from atomic update'
      );
    });

    it('should update cache after successful generation', async () => {
      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.updateDoc.mockResolvedValue({
        object: { sequence: 11 },
      });

      await sequenceService.getNextIssueNumber(mockClient, projectId);

      // Verify cache was updated
      const cached = sequenceService._sequenceCache.get(projectId);
      expect(cached).toBeDefined();
      expect(cached.sequence).toBe(11);
    });
  });

  describe('getNextIssueNumbers', () => {
    const projectId = 'test-project-id';
    const mockProject = {
      _id: projectId,
      identifier: 'TEST',
      space: 'test-space',
      sequence: 10,
    };

    it('should reserve multiple numbers atomically', async () => {
      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.updateDoc.mockResolvedValue({
        object: { sequence: 15 },
      });

      const result = await sequenceService.getNextIssueNumbers(mockClient, projectId, 5);

      expect(result).toEqual([11, 12, 13, 14, 15]);
      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:Project',
        'test-space',
        projectId,
        { $inc: { sequence: 5 } },
        true
      );
    });

    it('should throw error for invalid count', async () => {
      await expect(sequenceService.getNextIssueNumbers(mockClient, projectId, 0)).rejects.toThrow(
        'Count must be greater than 0'
      );

      await expect(sequenceService.getNextIssueNumbers(mockClient, projectId, -5)).rejects.toThrow(
        'Count must be greater than 0'
      );
    });

    it('should handle initialization for bulk reservation', async () => {
      const projectWithoutSequence = { ...mockProject, sequence: undefined };
      mockClient.findOne.mockResolvedValueOnce(projectWithoutSequence).mockResolvedValueOnce(null); // No existing issues

      mockClient.updateDoc
        .mockResolvedValueOnce() // Initialize
        .mockResolvedValueOnce({ object: { sequence: 3 } });

      const result = await sequenceService.getNextIssueNumbers(mockClient, projectId, 3);

      expect(result).toEqual([1, 2, 3]);
    });
  });
  describe('cache management', () => {
    it('should update cache with timestamp', () => {
      const projectId = 'test-project';
      const beforeTime = Date.now();

      sequenceService._updateCache(projectId, 10);

      const cached = sequenceService._sequenceCache.get(projectId);
      expect(cached.sequence).toBe(10);
      expect(cached.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(cached.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should clear all cache entries', () => {
      sequenceService._updateCache('project1', 10);
      sequenceService._updateCache('project2', 20);

      expect(sequenceService._sequenceCache.size).toBe(2);

      sequenceService.clearCache();

      expect(sequenceService._sequenceCache.size).toBe(0);
    });
  });

  describe('error handling', () => {
    const projectId = 'test-project-id';

    it('should log and rethrow errors', async () => {
      const testError = new Error('Database connection failed');
      mockClient.findOne.mockRejectedValue(testError);

      await expect(sequenceService.getNextIssueNumber(mockClient, projectId)).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get next issue number:', testError);
    });
  });

  describe('factory function', () => {
    it('should create SequenceService instance', () => {
      const service = createSequenceService(mockLogger);

      expect(service).toBeInstanceOf(SequenceService);
      expect(service.logger).toBe(mockLogger);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent requests correctly', async () => {
      const projectId = 'test-project-id';
      const mockProject = {
        _id: projectId,
        identifier: 'TEST',
        space: 'test-space',
        sequence: 10,
      };

      mockClient.findOne.mockResolvedValue(mockProject);

      // Simulate different results for concurrent calls
      let callCount = 0;
      mockClient.updateDoc.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          object: { sequence: 10 + callCount },
        });
      });

      // Launch concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(sequenceService.getNextIssueNumber(mockClient, projectId));
      }

      const results = await Promise.all(promises);

      // All results should be unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(5);
      expect(results).toEqual([11, 12, 13, 14, 15]);
    });
  });
});
