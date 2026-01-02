/**
 * HULLY-249: Test metadata caching behavior
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

describe('HULLY-249: Metadata Caching Tests', () => {
  let issueService;
  let mockClient;
  let findOneCalls;
  let findAllCalls;

  beforeEach(() => {
    jest.clearAllMocks();
    findOneCalls = 0;
    findAllCalls = 0;
    issueService = new IssueService(null, null);

    mockClient = {
      findOne: jest.fn(async (cls, query) => {
        findOneCalls++;
        if (cls === 'tracker:class:Project') {
          return {
            _id: 'project-123',
            identifier: query.identifier || 'TEST',
            name: 'Test Project',
          };
        }
        return null;
      }),
      findAll: jest.fn(async (cls, query) => {
        findAllCalls++;
        if (cls === 'tracker:class:Component') {
          return [
            { _id: 'comp-1', label: 'Frontend', space: query.space },
            { _id: 'comp-2', label: 'Backend', space: query.space },
          ];
        }
        if (cls === 'tracker:class:Milestone') {
          return [
            { _id: 'mile-1', label: 'v1.0', space: query.space },
            { _id: 'mile-2', label: 'v2.0', space: query.space },
          ];
        }
        return [];
      }),
    };
  });

  describe('Cache Hit Tests', () => {
    it('should cache project on first call and reuse on second call', async () => {
      const project1 = await issueService._getCachedProject(mockClient, 'HULLY');
      expect(project1).toBeDefined();
      expect(project1.identifier).toBe('HULLY');
      expect(findOneCalls).toBe(1);

      const project2 = await issueService._getCachedProject(mockClient, 'HULLY');
      expect(project2).toBeDefined();
      expect(findOneCalls).toBe(1);
      expect(project1).toBe(project2);
    });

    it('should cache components on first call and reuse on second call', async () => {
      const projectId = 'project-123';

      const components1 = await issueService._getCachedComponents(mockClient, projectId);
      expect(components1).toHaveLength(2);
      expect(findAllCalls).toBe(1);

      const components2 = await issueService._getCachedComponents(mockClient, projectId);
      expect(components2).toHaveLength(2);
      expect(findAllCalls).toBe(1);
      expect(components1).toBe(components2);
    });

    it('should cache milestones on first call and reuse on second call', async () => {
      const projectId = 'project-456';

      const milestones1 = await issueService._getCachedMilestones(mockClient, projectId);
      expect(milestones1).toHaveLength(2);
      expect(findAllCalls).toBe(1);

      const milestones2 = await issueService._getCachedMilestones(mockClient, projectId);
      expect(milestones2).toHaveLength(2);
      expect(findAllCalls).toBe(1);
    });

    it('should cache different projects separately', async () => {
      await issueService._getCachedProject(mockClient, 'PROJ-A');
      expect(findOneCalls).toBe(1);

      await issueService._getCachedProject(mockClient, 'PROJ-B');
      expect(findOneCalls).toBe(2);

      await issueService._getCachedProject(mockClient, 'PROJ-A');
      expect(findOneCalls).toBe(2);
    });
  });

  describe('Cache TTL Tests', () => {
    it('should have 5-minute TTL configured', () => {
      expect(issueService._cacheTTLMs).toBe(5 * 60 * 1000);
    });

    it('should expire cache entries after TTL', async () => {
      issueService._cacheTTLMs = 50;

      await issueService._getCachedProject(mockClient, 'TEST');
      expect(findOneCalls).toBe(1);

      await issueService._getCachedProject(mockClient, 'TEST');
      expect(findOneCalls).toBe(1);

      await new Promise((r) => setTimeout(r, 60));

      await issueService._getCachedProject(mockClient, 'TEST');
      expect(findOneCalls).toBe(2);
    });

    it('should validate cache correctly with _isCacheValid', () => {
      const now = Date.now();

      const freshEntry = { data: 'test', timestamp: now };
      expect(issueService._isCacheValid(freshEntry)).toBe(true);

      const expiredEntry = { data: 'test', timestamp: now - 6 * 60 * 1000 };
      expect(issueService._isCacheValid(expiredEntry)).toBe(false);

      expect(issueService._isCacheValid(null)).toBeFalsy();
      expect(issueService._isCacheValid(undefined)).toBeFalsy();
    });
  });

  describe('Cache Invalidation Tests', () => {
    it('should invalidate specific cache entry', async () => {
      await issueService._getCachedProject(mockClient, 'TEST');
      expect(findOneCalls).toBe(1);

      await issueService._getCachedProject(mockClient, 'TEST');
      expect(findOneCalls).toBe(1);

      issueService.invalidateCache('project', 'TEST');

      await issueService._getCachedProject(mockClient, 'TEST');
      expect(findOneCalls).toBe(2);
    });

    it('should invalidate all cache entries when no args provided', async () => {
      await issueService._getCachedProject(mockClient, 'PROJ-A');
      await issueService._getCachedProject(mockClient, 'PROJ-B');
      await issueService._getCachedComponents(mockClient, 'proj-id');
      expect(findOneCalls).toBe(2);
      expect(findAllCalls).toBe(1);

      await issueService._getCachedProject(mockClient, 'PROJ-A');
      await issueService._getCachedProject(mockClient, 'PROJ-B');
      await issueService._getCachedComponents(mockClient, 'proj-id');
      expect(findOneCalls).toBe(2);
      expect(findAllCalls).toBe(1);

      issueService.invalidateCache();

      await issueService._getCachedProject(mockClient, 'PROJ-A');
      await issueService._getCachedProject(mockClient, 'PROJ-B');
      await issueService._getCachedComponents(mockClient, 'proj-id');
      expect(findOneCalls).toBe(4);
      expect(findAllCalls).toBe(2);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate correct cache keys', () => {
      expect(issueService._getCacheKey('project', 'TEST')).toBe('project:TEST');
      expect(issueService._getCacheKey('components', 'proj-123')).toBe('components:proj-123');
      expect(issueService._getCacheKey('milestones', 'proj-456')).toBe('milestones:proj-456');
    });
  });

  describe('Performance Measurement', () => {
    it('should significantly reduce DB queries for repeated operations', async () => {
      const projectId = 'perf-test-project';

      for (let i = 0; i < 10; i++) {
        await issueService._getCachedProject(mockClient, 'PERF-TEST');
        await issueService._getCachedComponents(mockClient, projectId);
        await issueService._getCachedMilestones(mockClient, projectId);
      }

      expect(findOneCalls).toBe(1);
      expect(findAllCalls).toBe(2);
    });
  });
});
