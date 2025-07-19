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
  getStatusDescription: (_status) => 'Status description',
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
      addCollection: createMockFn(),
      uploadMarkup: createMockFn()
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

      mockClient.addCollection.mockResolvedValueOnce('new-issue-id');

      const result = await service.createIssue(
        mockClient,
        'TEST',
        'New Issue'
      );

      expect(result.content[0].text).toContain('TEST-6');
      expect(result.content[0].text).toContain('New Issue');
      expect(mockClient.addCollection.getCalls().length).toBeGreaterThan(0);
    });

    test('should validate priority', async () => {
      const mockProject = { _id: 'proj1' };
      mockClient.findOne.mockResolvedValueOnce(mockProject);

      await expect(
        service.createIssue(mockClient, 'TEST', 'Title', '', 'invalid')
      ).rejects.toThrow();
    });

    test('should create issue with description', async () => {
      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project'
      };

      mockClient.findOne
        .mockResolvedValueOnce(mockProject)  // project lookup
        .mockResolvedValueOnce({ number: 10 });  // last issue

      mockClient.addCollection.mockResolvedValueOnce('new-issue-id');
      mockClient.uploadMarkup.mockResolvedValueOnce('markup-ref-123');
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.createIssue(
        mockClient,
        'TEST',
        'Issue with Description',
        'This is a test description'
      );

      expect(result.content[0].text).toContain('TEST-11');
      expect(result.content[0].text).toContain('Issue with Description');

      // Verify uploadMarkup was called with correct parameters
      const uploadCalls = mockClient.uploadMarkup.getCalls();
      expect(uploadCalls.length).toBe(1);
      expect(uploadCalls[0][1]).toBe('new-issue-id');
      expect(uploadCalls[0][2]).toBe('description');
      expect(uploadCalls[0][3]).toBe('This is a test description');
      expect(uploadCalls[0][4]).toBe('markdown');

      // Verify updateDoc was called to set the description
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][1]).toBe('proj1');
      expect(updateCalls[0][2]).toBe('new-issue-id');
      expect(updateCalls[0][3]).toEqual({ description: 'markup-ref-123' });
    });
  });

  describe('createSubissue', () => {
    test('should create subissue with parent link', async () => {
      const mockParentIssue = {
        _id: 'parent-id',
        identifier: 'TEST-1',
        space: 'proj1',
        component: 'comp1',
        milestone: 'mile1',
        subIssues: 2
      };

      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project'
      };

      mockClient.findOne
        .mockResolvedValueOnce(mockParentIssue)  // parent issue lookup
        .mockResolvedValueOnce(mockProject)  // project lookup
        .mockResolvedValueOnce({ number: 15 });  // last issue

      mockClient.addCollection.mockResolvedValueOnce('sub-issue-id');
      mockClient.updateDoc.mockResolvedValueOnce(); // parent subIssues count update

      const result = await service.createSubissue(
        mockClient,
        'TEST-1',
        'Subissue Title'
      );

      expect(result.content[0].text).toContain('TEST-16');
      expect(result.content[0].text).toContain('Subissue Title');
      expect(result.content[0].text).toContain('Parent: TEST-1');

      // Verify addCollection was called with parent ID
      const addCalls = mockClient.addCollection.getCalls();
      expect(addCalls.length).toBe(1);
      expect(addCalls[0][1]).toBe('proj1');
      expect(addCalls[0][2]).toBe('parent-id'); // parent issue ID instead of NoParent
      expect(addCalls[0][4]).toBe('subIssues');
      expect(addCalls[0][5].attachedTo).toBe('parent-id');
      expect(addCalls[0][5].component).toBe('comp1'); // inherited from parent
      expect(addCalls[0][5].milestone).toBe('mile1'); // inherited from parent

      // Verify parent's subIssues count was updated
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][1]).toBe('proj1');
      expect(updateCalls[0][2]).toBe('parent-id');
      expect(updateCalls[0][3]).toEqual({ subIssues: 3 });
    });

    test('should create subissue with description', async () => {
      const mockParentIssue = {
        _id: 'parent-id',
        identifier: 'TEST-1',
        space: 'proj1',
        subIssues: 0
      };

      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project'
      };

      mockClient.findOne
        .mockResolvedValueOnce(mockParentIssue)  // parent issue lookup
        .mockResolvedValueOnce(mockProject)  // project lookup
        .mockResolvedValueOnce({ number: 20 });  // last issue

      mockClient.addCollection.mockResolvedValueOnce('sub-issue-id');
      mockClient.uploadMarkup.mockResolvedValueOnce('sub-markup-ref');
      mockClient.updateDoc
        .mockResolvedValueOnce() // description update
        .mockResolvedValueOnce(); // parent count update

      const result = await service.createSubissue(
        mockClient,
        'TEST-1',
        'Subissue with Description',
        'Subissue description text'
      );

      expect(result.content[0].text).toContain('TEST-21');

      // Verify uploadMarkup was called
      const uploadCalls = mockClient.uploadMarkup.getCalls();
      expect(uploadCalls.length).toBe(1);
      expect(uploadCalls[0][1]).toBe('sub-issue-id');
      expect(uploadCalls[0][2]).toBe('description');
      expect(uploadCalls[0][3]).toBe('Subissue description text');
      expect(uploadCalls[0][4]).toBe('markdown');
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

    test('should update issue description', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1'
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.uploadMarkup.mockResolvedValueOnce('updated-markup-ref');
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.updateIssue(
        mockClient,
        'TEST-1',
        'description',
        'Updated description text'
      );

      expect(result.content[0].text).toContain('description: Updated description text');

      // Verify uploadMarkup was called with issue._id
      const uploadCalls = mockClient.uploadMarkup.getCalls();
      expect(uploadCalls.length).toBe(1);
      expect(uploadCalls[0][1]).toBe('issue1'); // The actual issue ID, not identifier
      expect(uploadCalls[0][2]).toBe('description');
      expect(uploadCalls[0][3]).toBe('Updated description text');
      expect(uploadCalls[0][4]).toBe('markdown');

      // Verify updateDoc was called with the markup reference
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][1]).toBe('proj1');
      expect(updateCalls[0][2]).toBe('issue1');
      expect(updateCalls[0][3]).toEqual({ description: 'updated-markup-ref' });
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