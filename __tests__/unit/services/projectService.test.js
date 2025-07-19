/**
 * ProjectService Tests
 *
 * Tests for the project service module
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ProjectService } from '../../../src/services/ProjectService.js';

// Helper to create mock functions
function createMockFn() {
  const calls = [];
  const mockImplementations = [];

  const fn = async (...args) => {
    calls.push(args);
    if (mockImplementations.length > 0) {
      const impl = mockImplementations.shift();
      if (impl.type === 'value') {
        return impl.value;
      } else if (impl.type === 'error') {
        throw impl.error;
      }
    }
    return undefined;
  };

  fn.mockResolvedValue = (value) => {
    mockImplementations.push({ type: 'value', value });
    return fn;
  };

  fn.mockResolvedValueOnce = (value) => {
    mockImplementations.push({ type: 'value', value });
    return fn;
  };

  fn.mockRejectedValue = (error) => {
    mockImplementations.push({ type: 'error', error });
    return fn;
  };

  fn.getCalls = () => calls;
  fn.toHaveBeenCalled = () => calls.length > 0;
  fn.toHaveBeenCalledWith = (...args) => {
    return calls.some(call =>
      call.length === args.length &&
      call.every((arg, i) => arg === args[i])
    );
  };

  return fn;
}

describe('ProjectService Tests', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    service = new ProjectService();
    mockClient = {
      findAll: createMockFn(),
      findOne: createMockFn(),
      createDoc: createMockFn(),
      updateDoc: createMockFn()
    };
  });

  describe('Constructor', () => {
    test('should create instance', () => {
      expect(service).toBeInstanceOf(ProjectService);
    });
  });

  describe('listProjects', () => {
    test('should return formatted project list', async () => {
      const mockProjects = [
        {
          _id: 'proj1',
          name: 'Project One',
          identifier: 'PROJ1',
          description: 'First project',
          private: false,
          archived: false,
          owners: []
        }
      ];

      mockClient.findAll
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce({ length: 5 });

      const result = await service.listProjects(mockClient);

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Found 1 projects');
      expect(result.content[0].text).toContain('Project One (PROJ1)');
    });
  });

  describe('findProject', () => {
    test('should return project when found', async () => {
      const mockProject = { _id: 'proj1', identifier: 'TEST' };
      mockClient.findOne.mockResolvedValue(mockProject);

      const result = await service.findProject(mockClient, 'TEST');

      expect(result).toBe(mockProject);
    });

    test('should throw when project not found', async () => {
      mockClient.findOne.mockResolvedValue(null);

      await expect(
        service.findProject(mockClient, 'NOTFOUND')
      ).rejects.toThrow();
    });
  });

  describe('Response Format', () => {
    test('listProjects should return MCP-compatible response', async () => {
      mockClient.findAll
        .mockResolvedValueOnce([])  // projects
        .mockResolvedValueOnce({ length: 0 });  // count

      const result = await service.listProjects(mockClient);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    test('listComponents should return MCP-compatible response', async () => {
      mockClient.findOne.mockResolvedValueOnce({ _id: 'test', identifier: 'TEST' });
      mockClient.findAll.mockResolvedValueOnce([]);  // components

      const result = await service.listComponents(mockClient, 'TEST');
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    test('listMilestones should return MCP-compatible response', async () => {
      mockClient.findOne.mockResolvedValueOnce({ _id: 'test', identifier: 'TEST' });
      mockClient.findAll.mockResolvedValueOnce([]);  // milestones

      const result = await service.listMilestones(mockClient, 'TEST');
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    test('listGithubRepositories should return MCP-compatible response', async () => {
      mockClient.findAll.mockResolvedValueOnce([]);  // repositories

      const result = await service.listGithubRepositories(mockClient);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockClient.findAll.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.listGithubRepositories(mockClient)
      ).rejects.toThrow();
    });

    test('should validate milestone dates', async () => {
      mockClient.findOne.mockResolvedValue({ _id: 'proj1' });

      await expect(
        service.createMilestone(mockClient, 'TEST', 'v1', '', 'invalid-date')
      ).rejects.toThrow();
    });
  });

  describe('GitHub Repository Assignment', () => {
    test('should match repository by full name', async () => {
      const mockProject = { _id: 'proj1' };
      const mockRepos = [{
        _id: 'repo1',
        space: 'space1',
        name: 'org/repo',
        githubProject: null
      }];

      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.findAll.mockResolvedValue(mockRepos);

      await service.assignRepositoryToProject(mockClient, 'TEST', 'org/repo');

      expect(mockClient.updateDoc.toHaveBeenCalled()).toBe(true);
    });

    test('should throw error when repository not found by partial name', async () => {
      const mockProject = { _id: 'proj1' };
      const mockRepos = [{
        _id: 'repo1',
        space: 'space1',
        name: 'organization/myrepo',
        githubProject: null
      }];

      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.findAll.mockResolvedValue(mockRepos);

      await expect(
        service.assignRepositoryToProject(mockClient, 'TEST', 'myrepo')
      ).rejects.toThrow('Repository "myrepo" not found');
    });
  });
});