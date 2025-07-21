/**
 * Unit tests for DeletionService
 */

import { jest } from '@jest/globals';
import { DeletionService } from '../DeletionService.js';
import { HulyError } from '../../core/HulyError.js';

describe('DeletionService', () => {
  let deletionService;
  let mockClient;
  let mockLogger;

  beforeEach(() => {
    mockClient = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      deleteDoc: jest.fn(),
      removeDoc: jest.fn(),
      removeCollection: jest.fn(),
      updateDoc: jest.fn(),
      getHierarchy: jest.fn(),
      getModel: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    deletionService = new DeletionService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Issue deletion impact analysis', () => {
    it('should show impact when deleting issue with no sub-issues', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists (called twice - once in deleteIssue, once in analyzeIssueDeletionImpact)
      const mockIssue = {
        _id: 'issue-id',
        identifier: issueId,
        title: 'Test Issue',
        subIssues: 0,
        attachments: 0,
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockIssue) // First call in deleteIssue
        .mockResolvedValueOnce(mockIssue); // Second call in analyzeIssueDeletionImpact

      // Mock no sub-issues
      mockClient.findAll.mockResolvedValueOnce([]);

      // Use deleteIssue with dryRun to get impact analysis
      const result = await deletionService.deleteIssue(mockClient, issueId, { dryRun: true });

      expect(result.content[0].text).toContain('# Deletion Impact Analysis');
      expect(result.content[0].text).toContain('Sub-issues: 0');
    });

    it('should show sub-issues in impact analysis', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists (called twice)
      const mockIssue = {
        _id: 'issue-id',
        identifier: issueId,
        title: 'Parent Issue',
        subIssues: 2,
        attachments: 0,
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockIssue) // First call in deleteIssue
        .mockResolvedValueOnce(mockIssue); // Second call in analyzeIssueDeletionImpact

      // Mock sub-issues exist
      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'sub-1', identifier: 'PROJ-124', title: 'Sub Issue 1' },
        { _id: 'sub-2', identifier: 'PROJ-125', title: 'Sub Issue 2' },
      ]);

      const result = await deletionService.deleteIssue(mockClient, issueId, { dryRun: true });

      expect(result.content[0].text).toContain('Sub-issues: 2');
      expect(result.content[0].text).toContain('### Sub-issues to be deleted:');
      expect(result.content[0].text).toContain('PROJ-124');
      expect(result.content[0].text).toContain('PROJ-125');
    });

    it('should show project deletion impact', async () => {
      const projectId = 'PROJ';

      // Mock project exists (called twice)
      const mockProject = {
        _id: 'project-id',
        identifier: projectId,
        name: 'Test Project',
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // First call in deleteProject
        .mockResolvedValueOnce(mockProject); // Second call in analyzeProjectDeletionImpact

      // Mock project has issues
      mockClient.findAll
        .mockResolvedValueOnce([{ _id: 'issue-1' }, { _id: 'issue-2' }, { _id: 'issue-3' }]) // issues
        .mockResolvedValueOnce([]) // components
        .mockResolvedValueOnce([]) // milestones
        .mockResolvedValueOnce([]); // templates

      const result = await deletionService.deleteProject(mockClient, projectId, { dryRun: true });

      expect(result.content[0].text).toContain('# Deletion Impact Analysis');
      expect(result.content[0].text).toContain('**project**: PROJ');
      expect(result.content[0].text).toContain('Issues: 3');
    });

    it('should handle entity not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        deletionService.deleteIssue(mockClient, 'NONEXISTENT', { dryRun: true })
      ).rejects.toThrow(HulyError);
    });

    it('should show component deletion preview', async () => {
      const componentLabel = 'Frontend';
      const projectId = 'PROJ';

      // Mock component exists
      mockClient.findOne
        .mockResolvedValueOnce({ _id: 'project-id', identifier: projectId }) // project
        .mockResolvedValueOnce({
          _id: 'comp-1',
          label: componentLabel,
        }); // component

      // Mock issues using component
      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'issue-1', identifier: 'PROJ-1' },
        { _id: 'issue-2', identifier: 'PROJ-2' },
      ]);

      // deleteComponent with dryRun returns the impact analysis
      const result = await deletionService.deleteComponent(mockClient, projectId, componentLabel, {
        dryRun: true,
      });

      expect(result.content[0].text).toContain('Component deletion preview');
      expect(result.content[0].text).toContain('Affected issues: 2');
    });

    it('should show milestone deletion preview', async () => {
      const milestoneLabel = 'v1.0';
      const projectId = 'PROJ';

      // Mock milestone exists
      mockClient.findOne
        .mockResolvedValueOnce({ _id: 'project-id', identifier: projectId }) // project
        .mockResolvedValueOnce({
          _id: 'milestone-1',
          label: milestoneLabel,
        }); // milestone

      // Mock no issues using milestone
      mockClient.findAll.mockResolvedValueOnce([]);

      // deleteMilestone with dryRun returns the impact analysis
      const result = await deletionService.deleteMilestone(mockClient, projectId, milestoneLabel, {
        dryRun: true,
      });

      expect(result.content[0].text).toContain('Milestone deletion preview');
      expect(result.content[0].text).toContain('Affected issues: 0');
    });
  });

  describe('deleteIssue', () => {
    it('should delete issue without sub-issues', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists (called twice)
      const mockIssue = {
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
        subIssues: 0,
        attachments: 0,
        space: 'project-space',
        attachedTo: 'parent-id',
        attachedToClass: 'tracker:class:Project',
        collection: 'issues',
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockIssue) // First call in deleteIssue
        .mockResolvedValueOnce(mockIssue); // Second call in analyzeIssueDeletionImpact

      // Mock no sub-issues
      mockClient.findAll.mockResolvedValueOnce([]);

      // Mock successful deletion
      mockClient.removeCollection.mockResolvedValue({});

      const result = await deletionService.deleteIssue(mockClient, issueId, {
        cascade: true,
      });

      expect(result.content[0].text).toContain('Successfully deleted');
      expect(result.content[0].text).toContain('PROJ-123');
      expect(mockClient.removeCollection).toHaveBeenCalledTimes(1); // parent only
    });

    it('should perform dry run without deleting', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists (called twice for dryRun)
      const mockIssue = {
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
        subIssues: 1,
        attachments: 0,
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockIssue) // First call in deleteIssue
        .mockResolvedValueOnce(mockIssue); // Second call in analyzeIssueDeletionImpact

      // Mock sub-issues
      mockClient.findAll.mockResolvedValueOnce([{ _id: 'sub-1', identifier: 'PROJ-124' }]);

      const result = await deletionService.deleteIssue(mockClient, issueId, {
        dryRun: true,
        cascade: true,
      });

      expect(result.content[0].text).toContain('# Deletion Impact Analysis');
      expect(result.content[0].text).toContain('Sub-issues: 1');
      expect(mockClient.deleteDoc).not.toHaveBeenCalled();
    });

    it('should fail without cascade when sub-issues exist', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
      });

      // Mock sub-issues exist
      mockClient.findAll.mockResolvedValueOnce([{ _id: 'sub-1', identifier: 'PROJ-124' }]);

      await expect(
        deletionService.deleteIssue(mockClient, issueId, { cascade: false })
      ).rejects.toThrow(HulyError);
    });

    it('should force delete even with blockers', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists (called twice)
      const mockIssue = {
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
        subIssues: 0,
        attachments: 0,
        space: 'project-space',
        attachedTo: 'parent-id',
        attachedToClass: 'tracker:class:Project',
        collection: 'issues',
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockIssue) // First call in deleteIssue
        .mockResolvedValueOnce(mockIssue); // Second call in analyzeIssueDeletionImpact

      // Mock no sub-issues for _deleteIssueRecursive
      mockClient.findAll.mockResolvedValueOnce([]);

      // Mock successful deletion
      mockClient.removeCollection.mockResolvedValue({});

      const result = await deletionService.deleteIssue(mockClient, issueId, {
        force: true,
      });

      expect(result.content[0].text).toContain('Successfully deleted');
      expect(result.content[0].text).toContain('PROJ-123');
      expect(mockClient.removeCollection).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('should delete empty project', async () => {
      const projectId = 'PROJ';

      // Mock project exists (first call for findProject, second for analyzeProjectDeletionImpact)
      mockClient.findOne
        .mockResolvedValueOnce({
          _id: 'project-id',
          identifier: projectId,
          name: 'Test Project',
        })
        .mockResolvedValueOnce({
          _id: 'project-id',
          identifier: projectId,
          name: 'Test Project',
        });

      // Mock no related entities
      mockClient.findAll
        .mockResolvedValueOnce([]) // issues
        .mockResolvedValueOnce([]) // components
        .mockResolvedValueOnce([]) // milestones
        .mockResolvedValueOnce([]); // templates

      // Mock successful deletion
      mockClient.removeDoc.mockResolvedValue({});

      const result = await deletionService.deleteProject(mockClient, projectId);

      expect(result.content[0].text).toContain('Deleted project PROJ');
      expect(result.content[0].text).toContain('0 issues');
      expect(result.content[0].text).toContain('0 components');
      expect(result.content[0].text).toContain('0 milestones');
      expect(result.content[0].text).toContain('0 templates');
    });

    it('should delete project with all entities when forced', async () => {
      const projectId = 'PROJ';

      // Mock project exists (called multiple times)
      const mockProject = {
        _id: 'project-id',
        identifier: projectId,
        name: 'Test Project',
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // First call in deleteProject
        .mockResolvedValueOnce(mockProject) // Second call in analyzeProjectDeletionImpact
        .mockResolvedValueOnce({
          _id: 'issue-1',
          identifier: 'PROJ-1',
          space: 'project-id',
          attachedTo: 'project-id',
          attachedToClass: 'tracker:class:Project',
          collection: 'issues',
        }) // Issue 1 lookup in bulkDeleteIssues
        .mockResolvedValueOnce({
          _id: 'issue-2',
          identifier: 'PROJ-2',
          space: 'project-id',
          attachedTo: 'project-id',
          attachedToClass: 'tracker:class:Project',
          collection: 'issues',
        }); // Issue 2 lookup in bulkDeleteIssues

      // Mock related entities
      mockClient.findAll
        .mockResolvedValueOnce([
          { _id: 'issue-1', identifier: 'PROJ-1' },
          { _id: 'issue-2', identifier: 'PROJ-2' },
        ]) // issues in analyzeProjectDeletionImpact
        .mockResolvedValueOnce([{ _id: 'comp-1' }]) // components
        .mockResolvedValueOnce([{ _id: 'milestone-1' }]) // milestones
        .mockResolvedValueOnce([{ _id: 'template-1' }]) // templates
        .mockResolvedValueOnce([]) // No sub-issues for issue-1 in deleteIssue
        .mockResolvedValueOnce([]) // No sub-issues for issue-1 in _deleteIssueRecursive
        .mockResolvedValueOnce([]) // No sub-issues for issue-2 in deleteIssue
        .mockResolvedValueOnce([]); // No sub-issues for issue-2 in _deleteIssueRecursive

      // Mock successful deletions
      mockClient.removeDoc.mockResolvedValue({});
      mockClient.removeCollection.mockResolvedValue({});

      const result = await deletionService.deleteProject(mockClient, projectId, {
        force: true,
      });

      expect(result.content[0].text).toContain('Deleted project PROJ');
      expect(result.content[0].text).toContain('2 issues');
      expect(result.content[0].text).toContain('1 components');
      expect(result.content[0].text).toContain('1 milestones');
      expect(result.content[0].text).toContain('1 templates');
      expect(mockClient.removeDoc).toHaveBeenCalled();
    });

    it('should perform project deletion dry run', async () => {
      const projectId = 'PROJ';

      // Mock project exists (called twice)
      const mockProject = {
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
      };
      mockClient.findOne
        .mockResolvedValueOnce(mockProject) // First call in deleteProject
        .mockResolvedValueOnce(mockProject); // Second call in analyzeProjectDeletionImpact

      // Mock related entities
      mockClient.findAll
        .mockResolvedValueOnce([{ _id: 'issue-1' }]) // issues
        .mockResolvedValueOnce([]) // components
        .mockResolvedValueOnce([]) // milestones
        .mockResolvedValueOnce([]); // templates

      const result = await deletionService.deleteProject(mockClient, projectId, {
        dryRun: true,
      });

      expect(result.content[0].text).toContain('# Deletion Impact Analysis');
      expect(result.content[0].text).toContain('**project**: PROJ');
      expect(result.content[0].text).toContain('Issues: 1');
      expect(mockClient.removeDoc).not.toHaveBeenCalled();
    });
  });

  describe('deleteComponent', () => {
    it('should delete component and update affected issues', async () => {
      const componentLabel = 'Frontend';
      const projectId = 'PROJ';

      // Mock project and component exist
      mockClient.findOne
        .mockResolvedValueOnce({ _id: projectId }) // project
        .mockResolvedValueOnce({
          _id: 'comp-1',
          label: componentLabel,
        }); // component

      // Mock NO issues using component (so deletion can proceed without force)
      mockClient.findAll.mockResolvedValueOnce([]);

      // Mock deletion
      mockClient.removeDoc.mockResolvedValue({});

      const result = await deletionService.deleteComponent(mockClient, projectId, componentLabel);

      expect(result.content[0].text).toContain('Deleted component "Frontend"');
      expect(mockClient.removeDoc).toHaveBeenCalled();
    });

    it('should force delete component without updating issues', async () => {
      const componentLabel = 'Frontend';
      const projectId = 'PROJ';

      // Mock project and component exist
      mockClient.findOne
        .mockResolvedValueOnce({ _id: projectId }) // project
        .mockResolvedValueOnce({
          _id: 'comp-1',
          label: componentLabel,
        }); // component

      // Mock issues using component
      mockClient.findAll.mockResolvedValueOnce([{ _id: 'issue-1', component: 'comp-1' }]);

      // Mock deletion
      mockClient.removeDoc.mockResolvedValue({});

      const result = await deletionService.deleteComponent(mockClient, projectId, componentLabel, {
        force: true,
      });

      expect(result.content[0].text).toContain('Deleted component "Frontend"');
      expect(mockClient.updateDoc).toHaveBeenCalledTimes(1); // Should update the issue
      expect(mockClient.removeDoc).toHaveBeenCalled();
    });
  });

  describe('deleteMilestone', () => {
    it('should delete milestone and update affected issues', async () => {
      const milestoneLabel = 'v1.0';
      const projectId = 'PROJ';

      // Mock project and milestone exist
      mockClient.findOne
        .mockResolvedValueOnce({ _id: projectId }) // project
        .mockResolvedValueOnce({
          _id: 'milestone-1',
          label: milestoneLabel,
        }); // milestone

      // Mock NO issues using milestone (so deletion can proceed without force)
      mockClient.findAll.mockResolvedValueOnce([]);

      // Mock deletion
      mockClient.removeDoc.mockResolvedValue({});

      const result = await deletionService.deleteMilestone(mockClient, projectId, milestoneLabel);

      expect(result.content[0].text).toContain('Deleted milestone "v1.0"');
      expect(mockClient.removeDoc).toHaveBeenCalled();
    });
  });

  describe('archiveProject', () => {
    it('should archive project', async () => {
      const projectId = 'PROJ';

      // Mock project exists and is not archived
      mockClient.findOne.mockResolvedValueOnce({
        _id: 'project-actual-id',
        identifier: projectId,
        name: 'Test Project',
        archived: false,
        space: 'project-space',
      });

      // Mock update
      mockClient.updateDoc.mockResolvedValue({});

      const result = await deletionService.archiveProject(mockClient, projectId);

      expect(result.content[0].text).toContain('Archived project PROJ');
      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        expect.anything(), // class
        'project-space',
        'project-actual-id',
        { archived: true }
      );
    });

    it('should throw error if project already archived', async () => {
      const projectId = 'PROJ';

      // Mock project already archived
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
        archived: true,
      });

      await expect(deletionService.archiveProject(mockClient, projectId)).rejects.toThrow(
        'already archived'
      );
    });
  });
});
