/**
 * IssueService Tests
 * 
 * Tests for the issue service module
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { IssueService } from '../../../src/services/IssueService.js';

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

// Mock status manager
const mockStatusManager = {
  toHumanStatus: (status) => {
    const map = {
      'tracker:status:Backlog': 'backlog',
      'tracker:status:Todo': 'todo',
      'tracker:status:InProgress': 'in-progress',
      'tracker:status:Done': 'done',
      'tracker:status:Canceled': 'canceled'
    };
    return map[status] || status;
  },
  fromHumanStatus: (status) => {
    const map = {
      'backlog': 'tracker:status:Backlog',
      'todo': 'tracker:status:Todo',
      'in-progress': 'tracker:status:InProgress',
      'done': 'tracker:status:Done',
      'canceled': 'tracker:status:Canceled'
    };
    return map[status] || status;
  },
  getStatusDescription: (status) => 'Status description',
  getDefaultStatus: async () => 'tracker:status:Backlog',
  getValidStatuses: async () => [
    'tracker:status:Backlog',
    'tracker:status:Todo',
    'tracker:status:InProgress',
    'tracker:status:Done',
    'tracker:status:Canceled'
  ],
  getHumanStatuses: async () => ['backlog', 'todo', 'in-progress', 'done', 'canceled']
};

describe('IssueService Tests', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    service = new IssueService(mockStatusManager);
    mockClient = {
      findAll: createMockFn(),
      findOne: createMockFn(),
      createDoc: createMockFn(),
      updateDoc: createMockFn(),
      addCollection: createMockFn()
    };
  });

  describe('Constructor', () => {
    test('should create instance with status manager', () => {
      expect(service).toBeInstanceOf(IssueService);
      expect(service.statusManager).toBe(mockStatusManager);
    });
  });

  describe('listIssues', () => {
    test('should return formatted issue list', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'Test Issue',
          status: 'tracker:status:Backlog',
          priority: 2,
          description: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test description"}]}]}'
        }
      ];

      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll
        .mockResolvedValueOnce(mockIssues)  // issues
        .mockResolvedValueOnce([])  // components
        .mockResolvedValueOnce([]);  // milestones

      const result = await service.listIssues(mockClient, 'TEST');

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).toContain('Test Issue');
      expect(result.content[0].text).toContain('backlog');
    });

    test('should throw when project not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        service.listIssues(mockClient, 'NOTFOUND')
      ).rejects.toThrow();
    });
  });

  describe('createIssue', () => {
    test('should create issue with default values', async () => {
      const mockProject = { 
        _id: 'proj1', 
        identifier: 'TEST',
        name: 'Test Project'
      };

      mockClient.findOne
        .mockResolvedValueOnce(mockProject)  // project lookup
        .mockResolvedValueOnce({ number: 5 });  // last issue

      mockClient.createDoc.mockResolvedValueOnce('new-issue-id');

      const result = await service.createIssue(
        mockClient, 
        'TEST', 
        'New Issue'
      );

      expect(result.content[0].text).toContain('TEST-6');
      expect(result.content[0].text).toContain('New Issue');
      expect(mockClient.createDoc.toHaveBeenCalled()).toBe(true);
    });

    test('should validate priority', async () => {
      const mockProject = { _id: 'proj1' };
      mockClient.findOne.mockResolvedValueOnce(mockProject);

      await expect(
        service.createIssue(mockClient, 'TEST', 'Title', '', 'invalid')
      ).rejects.toThrow();
    });
  });

  describe('updateIssue', () => {
    test('should update issue title', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1'
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.updateIssue(
        mockClient,
        'TEST-1',
        'title',
        'New Title'
      );

      expect(result.content[0].text).toContain('Updated issue TEST-1');
      expect(result.content[0].text).toContain('title: New Title');
    });

    test('should update issue status', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1'
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.updateIssue(
        mockClient,
        'TEST-1',
        'status',
        'in-progress'
      );

      expect(result.content[0].text).toContain('status: in-progress');
      expect(mockClient.updateDoc.getCalls()[0][3]).toHaveProperty('status', 'tracker:status:InProgress');
    });
  });

  describe('searchIssues', () => {
    test('should search issues with filters', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'Matching Issue',
          status: 'tracker:status:Backlog',
          priority: 2,
          space: 'proj1',
          modifiedOn: Date.now()
        }
      ];

      mockClient.findOne
        .mockResolvedValueOnce(mockProject)  // initial project lookup
        .mockResolvedValueOnce(mockProject);  // project lookup in map
      mockClient.findAll
        .mockResolvedValueOnce(mockIssues);  // issues

      const result = await service.searchIssues(mockClient, {
        project_identifier: 'TEST',
        query: 'Matching'
      });

      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).toContain('Matching Issue');
    });
  });

  describe('Response Format', () => {
    test('all methods should return MCP-compatible responses', async () => {
      // Setup common mocks
      const mockProject = { _id: 'proj1', name: 'Test' };
      const mockIssue = { 
        _id: 'issue1', 
        identifier: 'TEST-1',
        space: 'proj1',
        comments: 0
      };

      // Test various methods
      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.findAll.mockResolvedValue([]);
      mockClient.createDoc.mockResolvedValue('id');
      mockClient.addCollection.mockResolvedValue();

      const methods = [
        () => service.listIssues(mockClient, 'TEST'),
        () => service.listComments(mockClient, 'TEST-1'),
        () => service.getIssueDetails(mockClient, 'TEST-1'),
        () => service.searchIssues(mockClient, {})
      ];

      for (const method of methods) {
        // Reset mocks for each iteration
        mockClient.findOne.mockResolvedValue(mockProject);
        mockClient.findAll
          .mockResolvedValueOnce([])  // issues or comments
          .mockResolvedValueOnce([])  // components
          .mockResolvedValueOnce([]);  // milestones
        
        // Add extra mock for issue lookup in some methods
        mockClient.findOne.mockResolvedValueOnce(mockProject);
        mockClient.findOne.mockResolvedValueOnce(mockIssue);
        
        const result = await method();
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0]).toHaveProperty('text');
      }
    });
  });
});