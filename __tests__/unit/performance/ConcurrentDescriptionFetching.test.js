/**
 * HULLY-250: Test concurrent description fetching
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('@hcengineering/tracker', () => ({
  default: {
    class: {
      Project: 'tracker:class:Project',
      Issue: 'tracker:class:Issue',
      IssueStatus: 'tracker:class:IssueStatus',
      Component: 'tracker:class:Component',
      Milestone: 'tracker:class:Milestone',
    },
    ids: { NoParent: 'tracker:ids:NoParent' },
    taskTypes: { Issue: 'tracker:taskTypes:Issue' },
    component: { Priority: { NoPriority: 0, Urgent: 1, High: 2, Medium: 3, Low: 4 } },
  },
}));

jest.unstable_mockModule('@hcengineering/core', () => ({
  default: { class: { Account: 'core:class:Account' } },
}));

jest.unstable_mockModule('@hcengineering/chunter', () => ({
  default: { class: { ChatMessage: 'chunter:class:ChatMessage' } },
}));

jest.unstable_mockModule('@hcengineering/activity', () => ({ default: {} }));
jest.unstable_mockModule('@hcengineering/task', () => ({ default: {} }));

const { IssueService } = await import('../../../src/services/IssueService.js');

describe('HULLY-250: Concurrent Description Fetching Tests', () => {
  let issueService;

  beforeEach(() => {
    jest.clearAllMocks();
    issueService = new IssueService(null, null);
  });

  describe('Parallel Execution Tests', () => {
    it('should fetch descriptions in parallel with Promise.all', async () => {
      const fetchDelay = 50;
      let concurrentCalls = 0;
      let maxConcurrent = 0;
      let totalCalls = 0;

      const mockClient = {
        fetchMarkup: jest.fn(async () => {
          totalCalls++;
          concurrentCalls++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
          await new Promise((r) => setTimeout(r, fetchDelay));
          concurrentCalls--;
          return 'Description text';
        }),
      };

      const issues = Array(10)
        .fill(null)
        .map((_, i) => ({
          _id: `issue-${i}`,
          identifier: `TEST-${i}`,
          description: 'abcdef012345678901234567',
        }));

      const start = Date.now();
      await issueService._fetchDescriptionsBatch(mockClient, issues, true);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(300);
      expect(totalCalls).toBe(10);
    });

    it('should be significantly faster than sequential for many issues', async () => {
      const fetchDelay = 20;

      const mockClient = {
        fetchMarkup: jest.fn(async () => {
          await new Promise((r) => setTimeout(r, fetchDelay));
          return 'Description text for issue';
        }),
      };

      const issues = Array(20)
        .fill(null)
        .map((_, i) => ({
          _id: `issue-${i}`,
          identifier: `PERF-${i}`,
          description: 'abcdef012345678901234567',
        }));

      const start = Date.now();
      const result = await issueService._fetchDescriptionsBatch(mockClient, issues, true);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
      expect(result.size).toBe(20);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle individual fetch failures without breaking batch', async () => {
      const mockClient = {
        fetchMarkup: jest.fn(async (cls, id) => {
          if (id === 'issue-5' || id === 'issue-10') {
            throw new Error('Fetch failed');
          }
          return 'Description text';
        }),
      };

      const issues = Array(15)
        .fill(null)
        .map((_, i) => ({
          _id: `issue-${i}`,
          identifier: `TEST-${i}`,
          description: 'abcdef012345678901234567',
        }));

      const result = await issueService._fetchDescriptionsBatch(mockClient, issues, true);

      expect(result.size).toBe(15);
      expect(result.get('issue-5')).toBe('');
      expect(result.get('issue-10')).toBe('');
      expect(result.get('issue-0')).toBe('Description text');
    });

    it('should not throw exception when all fetches fail', async () => {
      const mockClient = {
        fetchMarkup: jest.fn(async () => {
          throw new Error('Service unavailable');
        }),
      };

      const issues = Array(5)
        .fill(null)
        .map((_, i) => ({
          _id: `issue-${i}`,
          identifier: `FAIL-${i}`,
          description: 'abcdef012345678901234567',
        }));

      const result = await issueService._fetchDescriptionsBatch(mockClient, issues, true);

      expect(result.size).toBe(5);
      for (const value of result.values()) {
        expect(value).toBe('');
      }
    });
  });

  describe('Empty/Null Description Handling', () => {
    it('should only fetch for issues with valid MarkupRef descriptions', async () => {
      let fetchCount = 0;
      const mockClient = {
        fetchMarkup: jest.fn(async () => {
          fetchCount++;
          return 'Description text';
        }),
      };

      const issues = [
        { _id: 'has-desc', identifier: 'TEST-1', description: 'abcdef012345678901234567' },
        { _id: 'null-desc', identifier: 'TEST-2', description: null },
        { _id: 'empty-desc', identifier: 'TEST-3', description: '' },
        { _id: 'no-desc-field', identifier: 'TEST-4' },
        { _id: 'has-desc-2', identifier: 'TEST-5', description: 'fedcba987654321098765432' },
      ];

      const result = await issueService._fetchDescriptionsBatch(mockClient, issues, true);

      expect(fetchCount).toBe(2);
      expect(result.size).toBe(2);
      expect(result.has('has-desc')).toBe(true);
      expect(result.has('has-desc-2')).toBe(true);
    });

    it('should return empty Map when no issues have descriptions', async () => {
      const mockClient = {
        fetchMarkup: jest.fn(async () => 'text'),
      };

      const issues = [
        { _id: '1', identifier: 'TEST-1', description: null },
        { _id: '2', identifier: 'TEST-2' },
        { _id: '3', identifier: 'TEST-3', description: '' },
      ];

      const result = await issueService._fetchDescriptionsBatch(mockClient, issues, true);

      expect(result.size).toBe(0);
      expect(mockClient.fetchMarkup).not.toHaveBeenCalled();
    });
  });

  describe('includeDescriptions=false Tests', () => {
    it('should return empty Map when includeDescriptions is false', async () => {
      let fetchCount = 0;
      const mockClient = {
        fetchMarkup: jest.fn(async () => {
          fetchCount++;
          return 'Description text';
        }),
      };

      const issues = Array(10)
        .fill(null)
        .map((_, i) => ({
          _id: `issue-${i}`,
          identifier: `TEST-${i}`,
          description: 'abcdef012345678901234567',
        }));

      const result = await issueService._fetchDescriptionsBatch(mockClient, issues, false);

      expect(result.size).toBe(0);
      expect(fetchCount).toBe(0);
    });
  });

  describe('Empty Issues Array', () => {
    it('should handle empty issues array gracefully', async () => {
      const mockClient = {
        fetchMarkup: jest.fn(),
      };

      const result = await issueService._fetchDescriptionsBatch(mockClient, [], true);

      expect(result.size).toBe(0);
      expect(mockClient.fetchMarkup).not.toHaveBeenCalled();
    });
  });

  describe('Result Map Correctness', () => {
    it('should correctly map issue IDs to descriptions', async () => {
      const mockClient = {
        fetchMarkup: jest.fn(async (cls, id) => {
          return `Description for ${id}`;
        }),
      };

      const issues = [
        { _id: 'issue-alpha', identifier: 'TEST-1', description: 'abcdef012345678901234567' },
        { _id: 'issue-beta', identifier: 'TEST-2', description: 'fedcba987654321098765432' },
        { _id: 'issue-gamma', identifier: 'TEST-3', description: '123456789012345678901234' },
      ];

      const result = await issueService._fetchDescriptionsBatch(mockClient, issues, true);

      expect(result.get('issue-alpha')).toBe('Description for issue-alpha');
      expect(result.get('issue-beta')).toBe('Description for issue-beta');
      expect(result.get('issue-gamma')).toBe('Description for issue-gamma');
    });
  });

  describe('Performance Expectations', () => {
    it('should achieve > 3x speedup for 20+ issues', async () => {
      const fetchDelay = 30;
      const issueCount = 25;

      const mockClient = {
        fetchMarkup: jest.fn(async () => {
          await new Promise((r) => setTimeout(r, fetchDelay));
          return 'Description';
        }),
      };

      const issues = Array(issueCount)
        .fill(null)
        .map((_, i) => ({
          _id: `issue-${i}`,
          identifier: `BENCH-${i}`,
          description: 'abcdef012345678901234567',
        }));

      const sequentialEstimate = issueCount * fetchDelay;

      const start = Date.now();
      await issueService._fetchDescriptionsBatch(mockClient, issues, true);
      const parallelDuration = Date.now() - start;

      const speedup = sequentialEstimate / parallelDuration;
      expect(speedup).toBeGreaterThan(3);
    });
  });
});
