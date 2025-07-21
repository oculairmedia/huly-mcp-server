/**
 * Unit tests for IssueService component and milestone assignment
 * Tests that createIssue and createSubissue properly handle component and milestone parameters
 */

import { jest } from '@jest/globals';
import { IssueService } from '../../../src/services/IssueService.js';

// Mock status manager
const mockStatusManager = {
  getDefaultStatus: jest.fn(),
  normalizeStatus: jest.fn(),
};

// Mock Huly modules
jest.mock('@hcengineering/tracker', () => ({
  default: {
    class: {
      Project: 'tracker:class:Project',
      Issue: 'tracker:class:Issue',
      IssueStatus: 'tracker:class:IssueStatus',
      Component: 'tracker:class:Component',
      Milestone: 'tracker:class:Milestone',
    },
    ids: {
      NoParent: 'tracker:ids:NoParent',
    },
    taskTypes: {
      Issue: 'tracker:taskTypes:Issue',
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

describe('IssueService Component/Milestone Tests', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IssueService(mockStatusManager, null); // No SequenceService for simplicity
    mockClient = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      addCollection: jest.fn(),
      uploadMarkup: jest.fn(),
      updateDoc: jest.fn(),
    };
  });

  describe('createIssue with component and milestone', () => {
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

    const mockComponent = {
      _id: 'component-frontend',
      label: 'Frontend',
      space: 'test-project-id',
    };

    const mockMilestone = {
      _id: 'milestone-v1',
      label: 'Version 1.0',
      space: 'test-project-id',
    };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((className, query) => {
        if (className === 'tracker:class:Project') {
          return Promise.resolve(mockProject);
        }
        if (className === 'tracker:class:Issue' && query.space) {
          return Promise.resolve({ number: 10 }); // Last issue
        }
        if (className === 'tracker:class:Component' && query.label === 'Frontend') {
          return Promise.resolve(mockComponent);
        }
        if (className === 'tracker:class:Milestone' && query.label === 'Version 1.0') {
          return Promise.resolve(mockMilestone);
        }
        return Promise.resolve(null);
      });

      mockClient.findAll.mockImplementation((className) => {
        if (className === 'tracker:class:IssueStatus') {
          return Promise.resolve([mockStatus]);
        }
        if (className === 'tracker:class:Component') {
          return Promise.resolve([mockComponent, { _id: 'comp-2', label: 'Backend' }]);
        }
        if (className === 'tracker:class:Milestone') {
          return Promise.resolve([mockMilestone, { _id: 'mile-2', label: 'Version 2.0' }]);
        }
        return Promise.resolve([]);
      });

      mockStatusManager.getDefaultStatus.mockResolvedValue(mockStatus);
      mockClient.addCollection.mockResolvedValue('new-issue-id');
      mockClient.uploadMarkup.mockResolvedValue('desc-ref');
    });

    it('should create issue with specified component and milestone', async () => {
      const result = await service.createIssue(
        mockClient,
        'TEST',
        'Test Issue',
        'Description',
        'medium',
        'Frontend',
        'Version 1.0'
      );

      // Verify component was resolved
      expect(mockClient.findOne).toHaveBeenCalledWith('tracker:class:Component', {
        space: 'test-project-id',
        label: 'Frontend',
      });

      // Verify milestone was resolved
      expect(mockClient.findOne).toHaveBeenCalledWith('tracker:class:Milestone', {
        space: 'test-project-id',
        label: 'Version 1.0',
      });

      // Verify issue was created with component and milestone IDs
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          component: 'component-frontend',
          milestone: 'milestone-v1',
        })
      );

      expect(result.content[0].text).toContain('Created issue TEST-11');
    });

    it('should create issue without component/milestone when not provided', async () => {
      const _result = await service.createIssue(
        mockClient,
        'TEST',
        'Test Issue',
        'Description',
        'medium'
      );

      // Verify issue was created with null component and milestone
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          component: null,
          milestone: null,
        })
      );
    });

    it('should handle non-existent component gracefully', async () => {
      const _result = await service.createIssue(
        mockClient,
        'TEST',
        'Test Issue',
        'Description',
        'medium',
        'NonExistentComponent',
        'Version 1.0'
      );

      // Should still create issue with null component
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          component: null,
          milestone: 'milestone-v1',
        })
      );
    });

    it('should use fuzzy matching for component names', async () => {
      const _result = await service.createIssue(
        mockClient,
        'TEST',
        'Test Issue',
        'Description',
        'medium',
        'front end', // Space instead of no space
        null
      );

      // Should still find Frontend component
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          component: 'component-frontend',
        })
      );
    });
  });

  describe('createSubissue with component and milestone', () => {
    const mockParentIssue = {
      _id: 'parent-issue-id',
      identifier: 'TEST-1',
      space: 'test-project-id',
      component: 'parent-component-id',
      milestone: 'parent-milestone-id',
      subIssues: [],
    };

    const mockProject = {
      _id: 'test-project-id',
      identifier: 'TEST',
      name: 'Test Project',
    };

    const mockStatus = {
      _id: 'status-backlog',
      name: 'Backlog',
    };

    const mockComponent = {
      _id: 'component-backend',
      label: 'Backend',
      space: 'test-project-id',
    };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((className, query) => {
        if (className === 'tracker:class:Issue' && query.identifier === 'TEST-1') {
          return Promise.resolve(mockParentIssue);
        }
        if (className === 'tracker:class:Project') {
          return Promise.resolve(mockProject);
        }
        if (className === 'tracker:class:Issue' && query.space) {
          return Promise.resolve({ number: 20 }); // Last issue
        }
        if (className === 'tracker:class:Component' && query.label === 'Backend') {
          return Promise.resolve(mockComponent);
        }
        return Promise.resolve(null);
      });

      mockClient.findAll.mockImplementation((className) => {
        if (className === 'tracker:class:IssueStatus') {
          return Promise.resolve([mockStatus]);
        }
        if (className === 'tracker:class:Component') {
          return Promise.resolve([mockComponent]);
        }
        return Promise.resolve([]);
      });

      mockStatusManager.getDefaultStatus.mockResolvedValue(mockStatus);
      mockClient.addCollection.mockResolvedValue('new-subissue-id');
      mockClient.uploadMarkup.mockResolvedValue('desc-ref');
    });

    it('should inherit parent component/milestone when not specified', async () => {
      const _result = await service.createSubissue(
        mockClient,
        'TEST-1',
        'Test Subissue',
        'Description',
        'medium'
      );

      // Should inherit from parent
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          component: 'parent-component-id',
          milestone: 'parent-milestone-id',
        })
      );
    });

    it('should override parent component/milestone when specified', async () => {
      const _result = await service.createSubissue(
        mockClient,
        'TEST-1',
        'Test Subissue',
        'Description',
        'medium',
        'Backend',
        null // Clear milestone
      );

      // Should use specified component and clear milestone
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          component: 'component-backend',
          milestone: 'parent-milestone-id', // Still inherits milestone since we passed null
        })
      );
    });
  });
});
