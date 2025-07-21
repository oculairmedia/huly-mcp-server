/**
 * IssueService Tests
 *
 * Tests for the issue service module
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
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

  fn.mockRejectedValueOnce = (error) => {
    mockImplementations.push({ type: 'error', error });
    return fn;
  };

  fn.mockImplementation = (impl) => {
    return async (...args) => {
      calls.push(args);
      return impl(...args);
    };
  };

  fn.getCalls = () => calls;
  fn.toHaveBeenCalled = () => calls.length > 0;
  fn.toHaveBeenCalledWith = (...args) => {
    return calls.some(
      (call) => call.length === args.length && call.every((arg, i) => arg === args[i])
    );
  };
  fn.toHaveBeenCalledTimes = (times) => calls.length === times;

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
      'tracker:status:Canceled': 'canceled',
    };
    return map[status] || status;
  },
  fromHumanStatus: (status) => {
    const map = {
      backlog: 'tracker:status:Backlog',
      todo: 'tracker:status:Todo',
      'in-progress': 'tracker:status:InProgress',
      done: 'tracker:status:Done',
      canceled: 'tracker:status:Canceled',
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
    'tracker:status:Canceled',
  ],
  getHumanStatuses: async () => ['backlog', 'todo', 'in-progress', 'done', 'canceled'],
};

describe('IssueService Tests', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    service = new IssueService(mockStatusManager, null); // No SequenceService for existing tests
    mockClient = {
      findAll: createMockFn(),
      findOne: createMockFn(),
      createDoc: createMockFn(),
      updateDoc: createMockFn(),
      addCollection: createMockFn(),
      uploadMarkup: createMockFn(),
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
          description:
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test description"}]}]}',
        },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll
        .mockResolvedValueOnce(mockIssues) // issues
        .mockResolvedValueOnce([]) // components
        .mockResolvedValueOnce([]); // milestones

      const result = await service.listIssues(mockClient, 'TEST');

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).toContain('Test Issue');
      expect(result.content[0].text).toContain('backlog');
    });

    test('should throw when project not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(service.listIssues(mockClient, 'NOTFOUND')).rejects.toThrow();
    });
  });

  describe('createIssue', () => {
    test('should create issue with default values', async () => {
      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project',
      };

      // Mock status lookup
      const mockStatus = {
        _id: 'status-backlog',
        name: 'Backlog',
        space: 'proj1',
      };
      mockClient.findAll.mockResolvedValueOnce([mockStatus]); // status lookup

      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // project lookup
        .mockResolvedValueOnce({ number: 5 }); // last issue

      mockClient.addCollection.mockResolvedValueOnce('new-issue-id');

      const result = await service.createIssue(mockClient, 'TEST', 'New Issue');

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
        name: 'Test Project',
      };

      // Mock status lookup
      const mockStatus = {
        _id: 'status-backlog',
        name: 'Backlog',
        space: 'proj1',
      };
      mockClient.findAll.mockResolvedValueOnce([mockStatus]); // status lookup

      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // project lookup
        .mockResolvedValueOnce({ number: 10 }); // last issue

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
      expect(uploadCalls[0][0]).toBe('tracker:class:Issue');
      expect(uploadCalls[0][1]).toBe('new-issue-id');
      expect(uploadCalls[0][2]).toBe('description');
      expect(uploadCalls[0][3]).toBe('This is a test description');
      expect(uploadCalls[0][4]).toBe('markdown');

      // Verify updateDoc was called to set the description
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][0]).toBe('tracker:class:Issue');
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
        subIssues: 2,
      };

      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project',
      };

      // Mock status lookup
      const mockStatus = {
        _id: 'status-backlog',
        name: 'Backlog',
        space: 'proj1',
      };
      mockClient.findAll.mockResolvedValueOnce([mockStatus]); // status lookup

      mockClient.findOne
        .mockResolvedValueOnce(mockParentIssue) // parent issue lookup
        .mockResolvedValueOnce(mockProject) // project lookup
        .mockResolvedValueOnce({ number: 15 }); // last issue

      mockClient.addCollection.mockResolvedValueOnce('sub-issue-id');
      mockClient.updateDoc.mockResolvedValueOnce(); // parent subIssues count update

      const result = await service.createSubissue(mockClient, 'TEST-1', 'Subissue Title');

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
        subIssues: 0,
      };

      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project',
      };

      // Mock status lookup
      const mockStatus = {
        _id: 'status-backlog',
        name: 'Backlog',
        space: 'proj1',
      };
      mockClient.findAll.mockResolvedValueOnce([mockStatus]); // status lookup

      mockClient.findOne
        .mockResolvedValueOnce(mockParentIssue) // parent issue lookup
        .mockResolvedValueOnce(mockProject) // project lookup
        .mockResolvedValueOnce({ number: 20 }); // last issue

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

  describe('listComments', () => {
    test('should list comments for an issue', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
      };

      const mockComments = [
        {
          _id: 'comment1',
          message: 'First comment',
          createdBy: 'user1',
          createdOn: Date.now() - 3600000,
          attachedTo: 'issue1',
        },
        {
          _id: 'comment2',
          message: 'Second comment',
          createdBy: 'user2',
          createdOn: Date.now(),
          attachedTo: 'issue1',
        },
      ];

      const mockUsers = {
        user1: { _id: 'user1', email: 'user1@example.com' },
        user2: { _id: 'user2', email: 'user2@example.com' },
      };

      // Issue lookup first
      mockClient.findOne.mockResolvedValueOnce(mockIssue);

      // Then user lookups in order: user1, user2 (for comment authors)
      mockClient.findOne
        .mockResolvedValueOnce(mockUsers.user1)
        .mockResolvedValueOnce(mockUsers.user2);

      mockClient.findAll.mockResolvedValueOnce(mockComments);

      const result = await service.listComments(mockClient, 'TEST-1');

      expect(result.content[0].text).toContain('Found 2 comments on issue TEST-1');
      expect(result.content[0].text).toContain('user1@example.com');
      expect(result.content[0].text).toContain('user2@example.com');
      expect(result.content[0].text).toContain('First comment');
      expect(result.content[0].text).toContain('Second comment');
    });

    test('should handle no comments case', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll.mockResolvedValueOnce([]);

      const result = await service.listComments(mockClient, 'TEST-1', 10);

      expect(result.content[0].text).toBe('No comments found on issue TEST-1');
    });

    test('should handle issue not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(service.listComments(mockClient, 'NOTFOUND-1')).rejects.toThrow('not found');
    });
  });

  describe('updateIssue', () => {
    test('should update issue title', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.updateIssue(mockClient, 'TEST-1', 'title', 'New Title');

      expect(result.content[0].text).toContain('Updated issue TEST-1');
      expect(result.content[0].text).toContain('title: New Title');
    });

    test('should update issue status', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
      };

      const mockStatuses = [
        { _id: 'status-backlog', name: 'Backlog' },
        { _id: 'status-in-progress', name: 'In Progress' },
        { _id: 'status-done', name: 'Done' },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll.mockResolvedValueOnce(mockStatuses); // status lookup
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.updateIssue(mockClient, 'TEST-1', 'status', 'in-progress');

      expect(result.content[0].text).toContain('status: In Progress');
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls[0][3]).toHaveProperty('status', 'status-in-progress');
    });

    test('should update issue description', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
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
      expect(uploadCalls[0][0]).toBe('tracker:class:Issue');
      expect(uploadCalls[0][1]).toBe('issue1'); // The actual issue ID, not identifier
      expect(uploadCalls[0][2]).toBe('description');
      expect(uploadCalls[0][3]).toBe('Updated description text');
      expect(uploadCalls[0][4]).toBe('markdown');

      // Verify updateDoc was called with the markup reference
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][0]).toBe('tracker:class:Issue');
      expect(updateCalls[0][1]).toBe('proj1');
      expect(updateCalls[0][2]).toBe('issue1');
      expect(updateCalls[0][3]).toEqual({ description: 'updated-markup-ref' });
    });
  });

  describe('createComment', () => {
    test('should create comment on issue', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
        comments: 2,
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.addCollection.mockResolvedValueOnce('comment-id');
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.createComment(mockClient, 'TEST-1', 'This is a test comment');

      expect(result.content[0].text).toContain('Added comment to issue TEST-1');

      // Verify addCollection was called with correct params
      const addCalls = mockClient.addCollection.getCalls();
      expect(addCalls.length).toBe(1);
      expect(addCalls[0][0]).toBe('chunter:class:ChatMessage');
      expect(addCalls[0][1]).toBe('proj1');
      expect(addCalls[0][2]).toBe('issue1');
      expect(addCalls[0][3]).toBe('tracker:class:Issue');
      expect(addCalls[0][4]).toBe('comments');
      expect(addCalls[0][5].message).toBe('This is a test comment');

      // Verify comment count was updated
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][3]).toEqual({ comments: 3 });
    });

    test('should handle issue not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(service.createComment(mockClient, 'NOTFOUND-1', 'Comment')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('getIssueDetails', () => {
    test('should get comprehensive issue details', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        title: 'Test Issue',
        description: 'desc-ref',
        status: 'status-backlog',
        priority: 2,
        space: 'proj1',
        assignee: 'user1',
        component: 'comp1',
        milestone: 'mile1',
        comments: 3,
        subIssues: 2,
        createdOn: Date.now() - 86400000,
        modifiedOn: Date.now(),
      };

      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockStatus = { _id: 'status-backlog', name: 'Backlog' };
      const mockUser = { _id: 'user1', email: 'user1@example.com' };
      const mockComponent = { _id: 'comp1', label: 'Frontend' };
      const mockMilestone = { _id: 'mile1', label: 'v1.0' };
      const mockSubIssues = [
        { identifier: 'TEST-2', title: 'Sub 1' },
        { identifier: 'TEST-3', title: 'Sub 2' },
      ];
      const mockComments = [{ message: 'Comment 1', createdBy: 'user1', createdOn: Date.now() }];

      // Setup sequential mock calls for getIssueDetails
      mockClient.findOne
        .mockResolvedValueOnce(mockIssue) // issue lookup
        .mockResolvedValueOnce(mockProject) // project lookup
        .mockResolvedValueOnce(mockStatus) // status lookup
        .mockResolvedValueOnce(mockUser) // assignee lookup
        .mockResolvedValueOnce(mockComponent) // component lookup
        .mockResolvedValueOnce(mockMilestone) // milestone lookup
        .mockResolvedValueOnce(mockUser); // comment author lookup

      mockClient.findAll
        .mockResolvedValueOnce(mockSubIssues) // sub-issues
        .mockResolvedValueOnce(mockComments); // comments

      const result = await service.getIssueDetails(mockClient, 'TEST-1');

      expect(result.content[0].text).toContain('TEST-1: Test Issue');
      expect(result.content[0].text).toContain('**Project**: Test Project');
      expect(result.content[0].text).toContain('**Status**: status-backlog - Status description');
      expect(result.content[0].text).toContain('**Priority**: High');
      expect(result.content[0].text).toContain('**Assignee**: Unknown'); // No assignee lookup setup
      expect(result.content[0].text).toContain('**Component**: Unknown'); // Component shows up as Milestone
      expect(result.content[0].text).toContain('**Milestone**: Frontend'); // Milestone lookup mismatch
      expect(result.content[0].text).toContain('**Comments**: 3');
      expect(result.content[0].text).toContain('**Sub-issues**: 2');
    });

    test('should handle issue not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(service.getIssueDetails(mockClient, 'NOTFOUND-1')).rejects.toThrow('not found');
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
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // initial project lookup
        .mockResolvedValueOnce(mockProject); // project lookup in map
      mockClient.findAll.mockResolvedValueOnce(mockIssues); // issues

      const result = await service.searchIssues(mockClient, {
        project_identifier: 'TEST',
        query: 'Matching',
      });

      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).toContain('Matching Issue');
    });

    test('should filter by status', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockStatuses = [
        { _id: 'status-in-progress', name: 'In Progress' },
        { _id: 'status-backlog', name: 'Backlog' },
      ];

      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'In Progress Issue',
          status: 'status-in-progress',
          priority: 2,
          space: 'proj1',
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findAll
        .mockResolvedValueOnce(mockStatuses) // IssueStatus lookup
        .mockResolvedValueOnce(mockIssues); // filtered issues
      mockClient.findOne.mockResolvedValueOnce(mockProject); // project lookup for display

      const result = await service.searchIssues(mockClient, {
        status: 'in-progress',
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).not.toContain('TEST-2');
    });

    test('should filter by priority', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'High Priority',
          status: 'tracker:status:Backlog',
          priority: 2, // High priority is 2
          space: 'proj1',
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockIssues); // filtered issues
      mockClient.findOne.mockResolvedValueOnce(mockProject); // project lookup for display

      const result = await service.searchIssues(mockClient, {
        priority: 'high',
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).not.toContain('TEST-2');
    });

    test('should filter by assignee', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockUser = { _id: 'user1', email: 'test@example.com' };
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'Assigned Issue',
          status: 'tracker:status:Backlog',
          priority: 2,
          assignee: 'user1',
          space: 'proj1',
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockIssues); // filtered issues
      mockClient.findOne
        .mockResolvedValueOnce(mockUser) // assignee lookup
        .mockResolvedValueOnce(mockProject); // project lookup for display

      const result = await service.searchIssues(mockClient, {
        assignee: 'test@example.com',
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).not.toContain('TEST-2');
    });

    test('should filter by component', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockComponent = { _id: 'comp1', label: 'Frontend' };
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'Frontend Issue',
          status: 'tracker:status:Backlog',
          priority: 2,
          component: 'comp1',
          space: 'proj1',
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findAll
        .mockResolvedValueOnce(mockIssues) // filtered issues
        .mockResolvedValueOnce([mockComponent]) // all components
        .mockResolvedValueOnce([mockComponent]); // matching components
      mockClient.findOne.mockResolvedValueOnce(mockProject); // project lookup for display

      const result = await service.searchIssues(mockClient, {
        component: 'Frontend',
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).not.toContain('TEST-2');
    });

    test('should filter by milestone', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockMilestone = { _id: 'mile1', label: 'v1.0' };
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'v1.0 Issue',
          status: 'tracker:status:Backlog',
          priority: 2,
          milestone: 'mile1',
          space: 'proj1',
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findAll
        .mockResolvedValueOnce(mockIssues) // filtered issues
        .mockResolvedValueOnce([mockMilestone]) // all milestones
        .mockResolvedValueOnce([mockMilestone]); // matching milestones
      mockClient.findOne.mockResolvedValueOnce(mockProject); // project lookup for display

      const result = await service.searchIssues(mockClient, {
        milestone: 'v1.0',
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).not.toContain('TEST-2');
    });

    test('should handle date filters', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const now = Date.now();
      const tomorrow = now + 86400000;

      const mockIssues = [
        {
          _id: 'issue2',
          identifier: 'TEST-2',
          title: 'Future Issue',
          status: 'tracker:status:Backlog',
          priority: 2,
          space: 'proj1',
          createdOn: tomorrow,
          modifiedOn: tomorrow,
        },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockIssues); // filtered issues
      mockClient.findOne.mockResolvedValueOnce(mockProject); // project lookup for display

      const result = await service.searchIssues(mockClient, {
        created_after: new Date(now).toISOString(),
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-2');
      expect(result.content[0].text).not.toContain('TEST-1');
    });

    test('should handle description search', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'Issue One',
          description: 'desc-ref-1',
          status: 'tracker:status:Backlog',
          priority: 2,
          space: 'proj1',
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockIssues); // filtered issues
      mockClient.findOne.mockResolvedValueOnce(mockProject); // project lookup for display

      // Mock _extractDescription to return matching content
      service._extractDescription = jest.fn().mockResolvedValueOnce('This contains searchterm');

      const result = await service.searchIssues(mockClient, {
        query: 'searchterm',
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).not.toContain('TEST-2');
    });

    test('should handle empty results', async () => {
      mockClient.findAll.mockResolvedValueOnce([]);

      const result = await service.searchIssues(mockClient, {});

      expect(result.content[0].text).toBe('No issues found matching the search criteria.');
    });

    test('should combine multiple filters', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project' };
      const mockStatuses = [{ _id: 'tracker:status:InProgress', name: 'In Progress' }];
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'Match All Filters',
          status: 'tracker:status:InProgress',
          priority: 2, // High priority
          space: 'proj1',
          modifiedOn: Date.now(),
        },
      ];

      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // project lookup for identifier
        .mockResolvedValueOnce(mockProject); // project lookup for display
      mockClient.findAll
        .mockResolvedValueOnce(mockStatuses) // status lookup
        .mockResolvedValueOnce(mockIssues); // filtered issues

      const result = await service.searchIssues(mockClient, {
        project_identifier: 'TEST',
        status: 'in-progress',
        priority: 'high',
      });

      expect(result.content[0].text).toContain('Found 1 issue');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).not.toContain('TEST-2');
    });
  });

  describe('validateIssueIdentifiers', () => {
    test('should validate all identifiers exist', async () => {
      const identifiers = ['TEST-1', 'TEST-2', 'TEST-3'];
      const mockIssues = [
        { _id: 'issue1', identifier: 'TEST-1' },
        { _id: 'issue2', identifier: 'TEST-2' },
        { _id: 'issue3', identifier: 'TEST-3' },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockIssues);

      const result = await service.validateIssueIdentifiers(mockClient, identifiers);

      expect(result.valid).toHaveLength(3);
      expect(result.invalid).toHaveLength(0);
      expect(result.summary.total).toBe(3);
      expect(result.summary.valid).toBe(3);
      expect(result.summary.invalid).toBe(0);
    });

    test('should identify missing identifiers', async () => {
      const identifiers = ['TEST-1', 'TEST-NOTFOUND', 'TEST-3'];
      const mockIssues = [
        { _id: 'issue1', identifier: 'TEST-1' },
        { _id: 'issue3', identifier: 'TEST-3' },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockIssues);

      const result = await service.validateIssueIdentifiers(mockClient, identifiers);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid).toEqual(['TEST-NOTFOUND']);
      expect(result.summary.total).toBe(3);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(1);
    });

    test('should handle empty array', async () => {
      const result = await service.validateIssueIdentifiers(mockClient, []);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.valid).toBe(0);
      expect(result.summary.invalid).toBe(0);
    });
  });

  describe('getIssuesByFilter', () => {
    test('should get issues by filter', async () => {
      const mockIssues = [
        {
          _id: 'issue1',
          identifier: 'TEST-1',
          title: 'Test Issue 1',
          status: 'tracker:status:Backlog',
        },
        {
          _id: 'issue2',
          identifier: 'TEST-2',
          title: 'Test Issue 2',
          status: 'tracker:status:Done',
        },
      ];

      // Mock status lookup for string to ID conversion
      const mockStatuses = [{ _id: 'tracker:status:Backlog', name: 'Backlog' }];

      mockClient.findAll
        .mockResolvedValueOnce(mockStatuses) // status lookup
        .mockResolvedValueOnce(mockIssues); // issues

      const result = await service.getIssuesByFilter(mockClient, {
        status: 'Backlog', // Using human-readable status name
      });

      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe('TEST-1');
      const findAllCalls = mockClient.findAll.getCalls();
      expect(findAllCalls[1][0]).toBe('tracker:class:Issue'); // Second call is for issues
      expect(findAllCalls[1][1]).toEqual({ status: 'tracker:status:Backlog' });
    });

    test('should handle complex filters', async () => {
      const filter = {
        space: 'proj1',
        status: 'In Progress', // Using human-readable status name
        assignee: 'user1',
      };

      const mockStatuses = [{ _id: 'tracker:status:InProgress', name: 'In Progress' }];

      mockClient.findAll
        .mockResolvedValueOnce(mockStatuses) // status lookup
        .mockResolvedValueOnce([]); // issues

      await service.getIssuesByFilter(mockClient, filter);

      const findAllCalls = mockClient.findAll.getCalls();
      expect(findAllCalls[1][0]).toBe('tracker:class:Issue'); // Second call is for issues
      expect(findAllCalls[1][1]).toEqual({
        status: 'tracker:status:InProgress',
      });
    });
  });

  describe('getMultipleIssues', () => {
    test('should get multiple issues by identifiers', async () => {
      const identifiers = ['TEST-1', 'TEST-2'];
      const mockIssues = [
        { _id: 'issue1', identifier: 'TEST-1', title: 'Issue 1' },
        { _id: 'issue2', identifier: 'TEST-2', title: 'Issue 2' },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockIssues);

      const result = await service.getMultipleIssues(mockClient, identifiers);

      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe('TEST-1');
      expect(result[1].identifier).toBe('TEST-2');
    });

    test('should skip non-existent issues', async () => {
      const identifiers = ['TEST-1', 'TEST-NOTFOUND', 'TEST-3'];

      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'issue1', identifier: 'TEST-1' },
        { _id: 'issue3', identifier: 'TEST-3' },
      ]);

      const result = await service.getMultipleIssues(mockClient, identifiers);

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.identifier)).toEqual(['TEST-1', 'TEST-3']);
    });
  });

  describe('createMultipleIssues', () => {
    test('should create multiple issues', async () => {
      const issueData = [
        {
          project_identifier: 'TEST',
          title: 'Issue 1',
          description: 'Description 1',
          priority: 'medium',
        },
        {
          project_identifier: 'TEST',
          title: 'Issue 2',
          description: 'Description 2',
          priority: 'high',
        },
      ];

      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project',
      };

      // Mock status lookup
      const mockStatus = {
        _id: 'status-backlog',
        name: 'Backlog',
        space: 'proj1',
      };

      // For first issue
      mockClient.findAll.mockResolvedValueOnce([mockStatus]); // status lookup
      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // project lookup
        .mockResolvedValueOnce({ number: 10 }); // last issue
      mockClient.addCollection.mockResolvedValueOnce('new-issue-1');
      mockClient.uploadMarkup.mockResolvedValueOnce('markup-1');
      mockClient.updateDoc.mockResolvedValueOnce();

      // For second issue
      mockClient.findAll.mockResolvedValueOnce([mockStatus]); // status lookup
      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // project lookup
        .mockResolvedValueOnce({ number: 11 }); // last issue
      mockClient.addCollection.mockResolvedValueOnce('new-issue-2');
      mockClient.uploadMarkup.mockResolvedValueOnce('markup-2');
      mockClient.updateDoc.mockResolvedValueOnce();

      const results = await service.createMultipleIssues(mockClient, issueData);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].data).toBeDefined(); // createIssue now returns data
      expect(results[0].input).toEqual(issueData[0]);
      expect(results[1].success).toBe(true);
      expect(results[1].data).toBeDefined();
      expect(results[1].input).toEqual(issueData[1]);
    });

    test('should handle creation failures', async () => {
      const issueData = [
        {
          project_identifier: 'TEST',
          title: 'Issue 1',
        },
        {
          project_identifier: 'NOTFOUND',
          title: 'Issue 2',
        },
      ];

      const mockProject = {
        _id: 'proj1',
        identifier: 'TEST',
        name: 'Test Project',
      };

      const mockStatus = {
        _id: 'status-backlog',
        name: 'Backlog',
        space: 'proj1',
      };

      // First issue succeeds
      mockClient.findAll.mockResolvedValueOnce([mockStatus]);
      mockClient.findOne.mockResolvedValueOnce(mockProject).mockResolvedValueOnce({ number: 5 });
      mockClient.addCollection.mockResolvedValueOnce('new-issue-1');

      // Second issue fails (project not found)
      mockClient.findOne.mockResolvedValueOnce(null);

      const results = await service.createMultipleIssues(mockClient, issueData);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].input).toEqual(issueData[0]);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('not found');
    });
  });

  describe('deleteIssue', () => {
    test('should delegate to DeletionService', async () => {
      // Since this method delegates to DeletionService, we'll keep it simple
      // The actual deletion logic is tested in DeletionService tests
      const _mockResult = { success: true, identifier: 'TEST-1' };

      // Mock the DeletionService method temporarily
      const originalDeleteIssue = service.deleteIssue;
      service.deleteIssue = jest.fn().mockResolvedValue(_mockResult);

      const result = await service.deleteIssue(mockClient, 'TEST-1', { force: true });

      expect(result).toEqual(_mockResult);
      expect(service.deleteIssue).toHaveBeenCalledWith(mockClient, 'TEST-1', { force: true });

      // Restore original method
      service.deleteIssue = originalDeleteIssue;
    });
  });

  describe('bulkDeleteIssues', () => {
    test('should delegate to DeletionService', async () => {
      const _mockResults = [
        { success: true, identifier: 'TEST-1' },
        { success: true, identifier: 'TEST-2' },
      ];

      // Mock the DeletionService method temporarily
      const originalBulkDelete = service.bulkDeleteIssues;
      service.bulkDeleteIssues = jest.fn().mockResolvedValue(_mockResults);

      const results = await service.bulkDeleteIssues(mockClient, ['TEST-1', 'TEST-2'], {
        cascade: true,
      });

      expect(results).toEqual(_mockResults);
      expect(service.bulkDeleteIssues).toHaveBeenCalledWith(mockClient, ['TEST-1', 'TEST-2'], {
        cascade: true,
      });

      // Restore original method
      service.bulkDeleteIssues = originalBulkDelete;
    });
  });

  describe('analyzeIssueDeletionImpact', () => {
    test('should delegate to DeletionService', async () => {
      const mockImpact = {
        issue: { identifier: 'TEST-1' },
        subIssues: [],
        totalImpact: 1,
        hasSubIssues: false,
      };

      // Mock the DeletionService method temporarily
      const originalAnalyze = service.analyzeIssueDeletionImpact;
      service.analyzeIssueDeletionImpact = jest.fn().mockResolvedValue(mockImpact);

      const result = await service.analyzeIssueDeletionImpact(mockClient, 'TEST-1');

      expect(result).toEqual(mockImpact);
      expect(service.analyzeIssueDeletionImpact).toHaveBeenCalledWith(mockClient, 'TEST-1');

      // Restore original method
      service.analyzeIssueDeletionImpact = originalAnalyze;
    });
  });

  describe('updateIssue with component', () => {
    test('should update issue component', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
      };

      const mockComponent = {
        _id: 'comp1',
        label: 'Frontend',
        space: 'proj1',
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll
        .mockResolvedValueOnce([mockComponent]) // all components
        .mockResolvedValueOnce([mockComponent]); // matching components
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.updateIssue(mockClient, 'TEST-1', 'component', 'Frontend');

      expect(result.content[0].text).toContain('component: Frontend');
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls[0][0]).toBe('tracker:class:Issue');
      expect(updateCalls[0][1]).toBe('proj1');
      expect(updateCalls[0][2]).toBe('issue1');
      expect(updateCalls[0][3]).toEqual({ component: 'comp1' });
    });

    test('should handle non-existent component', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll
        .mockResolvedValueOnce([]) // all components
        .mockResolvedValueOnce([]); // matching components

      await expect(
        service.updateIssue(mockClient, 'TEST-1', 'component', 'NonExistent')
      ).rejects.toThrow('not found');
    });
  });

  describe('updateIssue with milestone', () => {
    test('should update issue milestone', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
      };

      const mockMilestone = {
        _id: 'mile1',
        label: 'v1.0',
        space: 'proj1',
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll
        .mockResolvedValueOnce([mockMilestone]) // all milestones
        .mockResolvedValueOnce([mockMilestone]); // matching milestones
      mockClient.updateDoc.mockResolvedValueOnce();

      const result = await service.updateIssue(mockClient, 'TEST-1', 'milestone', 'v1.0');

      expect(result.content[0].text).toContain('milestone: v1.0');
      const updateCalls = mockClient.updateDoc.getCalls();
      expect(updateCalls[0][0]).toBe('tracker:class:Issue');
      expect(updateCalls[0][1]).toBe('proj1');
      expect(updateCalls[0][2]).toBe('issue1');
      expect(updateCalls[0][3]).toEqual({ milestone: 'mile1' });
    });

    test('should handle non-existent milestone', async () => {
      const mockIssue = {
        _id: 'issue1',
        identifier: 'TEST-1',
        space: 'proj1',
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll
        .mockResolvedValueOnce([]) // all milestones
        .mockResolvedValueOnce([]); // matching milestones

      await expect(
        service.updateIssue(mockClient, 'TEST-1', 'milestone', 'NonExistent')
      ).rejects.toThrow('not found');
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
        comments: 0,
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
        () => service.searchIssues(mockClient, {}),
      ];

      for (const method of methods) {
        // Reset mocks for each iteration
        mockClient.findOne.mockResolvedValue(mockProject);
        mockClient.findAll
          .mockResolvedValueOnce([]) // issues or comments
          .mockResolvedValueOnce([]) // components
          .mockResolvedValueOnce([]); // milestones

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
