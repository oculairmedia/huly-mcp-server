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

  describe('validateDeletion', () => {
    it('should validate issue deletion with no blockers', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
      });

      // Mock no sub-issues
      mockClient.findAll.mockResolvedValueOnce([]);

      const result = await deletionService.validateDeletion(mockClient, 'issue', issueId);

      expect(result.canDelete).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect sub-issues as blockers', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: issueId,
        identifier: issueId,
        title: 'Parent Issue',
      });

      // Mock sub-issues exist
      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'sub-1', identifier: 'PROJ-124', title: 'Sub Issue 1' },
        { _id: 'sub-2', identifier: 'PROJ-125', title: 'Sub Issue 2' },
      ]);

      const result = await deletionService.validateDeletion(mockClient, 'issue', issueId);

      expect(result.canDelete).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0].type).toBe('has_sub_issues');
      expect(result.impact.subIssues).toBe(2);
    });

    it('should validate project deletion', async () => {
      const projectId = 'PROJ';

      // Mock project exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
      });

      // Mock project has issues
      mockClient.findAll
        .mockResolvedValueOnce([{ _id: 'issue-1' }, { _id: 'issue-2' }, { _id: 'issue-3' }]) // issues
        .mockResolvedValueOnce([]) // components
        .mockResolvedValueOnce([]) // milestones
        .mockResolvedValueOnce([]); // templates

      const result = await deletionService.validateDeletion(mockClient, 'project', projectId);

      expect(result.canDelete).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0].type).toBe('has_active_issues');
      expect(result.impact.issues).toBe(3);
    });

    it('should handle entity not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        deletionService.validateDeletion(mockClient, 'issue', 'NONEXISTENT')
      ).rejects.toThrow(HulyError);
    });

    it('should validate component deletion', async () => {
      const componentLabel = 'Frontend';
      const projectId = 'PROJ';

      // Mock component exists
      mockClient.findOne
        .mockResolvedValueOnce({ _id: projectId }) // project
        .mockResolvedValueOnce({
          _id: 'comp-1',
          label: componentLabel,
        }); // component

      // Mock issues using component
      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'issue-1', identifier: 'PROJ-1' },
        { _id: 'issue-2', identifier: 'PROJ-2' },
      ]);

      const result = await deletionService.validateDeletion(
        mockClient,
        'component',
        componentLabel,
        { projectIdentifier: projectId }
      );

      expect(result.canDelete).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0].type).toBe('in_use_by_issues');
      expect(result.impact.affectedIssues).toBe(2);
    });

    it('should validate milestone deletion', async () => {
      const milestoneLabel = 'v1.0';
      const projectId = 'PROJ';

      // Mock milestone exists
      mockClient.findOne
        .mockResolvedValueOnce({ _id: projectId }) // project
        .mockResolvedValueOnce({
          _id: 'milestone-1',
          label: milestoneLabel,
        }); // milestone

      // Mock no issues using milestone
      mockClient.findAll.mockResolvedValueOnce([]);

      const result = await deletionService.validateDeletion(
        mockClient,
        'milestone',
        milestoneLabel,
        { projectIdentifier: projectId }
      );

      expect(result.canDelete).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe('deleteIssue', () => {
    it('should delete issue with cascade option', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
      });

      // Mock sub-issues
      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'sub-1', identifier: 'PROJ-124' },
        { _id: 'sub-2', identifier: 'PROJ-125' },
      ]);

      // Mock successful deletions
      mockClient.deleteDoc.mockResolvedValue({});

      const result = await deletionService.deleteIssue(mockClient, issueId, {
        cascade: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.cascadeDeleted.subIssues).toBe(2);
      expect(mockClient.deleteDoc).toHaveBeenCalledTimes(3); // parent + 2 sub-issues
    });

    it('should perform dry run without deleting', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
      });

      // Mock sub-issues
      mockClient.findAll.mockResolvedValueOnce([{ _id: 'sub-1', identifier: 'PROJ-124' }]);

      const result = await deletionService.deleteIssue(mockClient, issueId, {
        dryRun: true,
        cascade: true,
      });

      expect(result.deleted).toBe(false);
      expect(result.dryRun).toBe(true);
      expect(result.wouldDelete.subIssues).toBe(1);
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
      ).rejects.toThrow('Cannot delete issue with sub-issues');
    });

    it('should force delete even with blockers', async () => {
      const issueId = 'PROJ-123';

      // Mock issue exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: issueId,
        identifier: issueId,
        title: 'Test Issue',
      });

      // Mock sub-issues
      mockClient.findAll.mockResolvedValueOnce([{ _id: 'sub-1', identifier: 'PROJ-124' }]);

      // Mock successful deletion
      mockClient.deleteDoc.mockResolvedValue({});

      const result = await deletionService.deleteIssue(mockClient, issueId, {
        force: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.forced).toBe(true);
      expect(mockClient.deleteDoc).toHaveBeenCalledWith(issueId);
    });
  });

  describe('deleteProject', () => {
    it('should delete empty project', async () => {
      const projectId = 'PROJ';

      // Mock project exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
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
      mockClient.deleteDoc.mockResolvedValue({});

      const result = await deletionService.deleteProject(mockClient, projectId);

      expect(result.deleted).toBe(true);
      expect(result.deletedCounts).toEqual({
        issues: 0,
        components: 0,
        milestones: 0,
        templates: 0,
      });
    });

    it('should delete project with all entities when forced', async () => {
      const projectId = 'PROJ';

      // Mock project exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
      });

      // Mock related entities
      mockClient.findAll
        .mockResolvedValueOnce([{ _id: 'issue-1' }, { _id: 'issue-2' }]) // issues
        .mockResolvedValueOnce([{ _id: 'comp-1' }]) // components
        .mockResolvedValueOnce([{ _id: 'milestone-1' }]) // milestones
        .mockResolvedValueOnce([{ _id: 'template-1' }]); // templates

      // Mock successful deletions
      mockClient.deleteDoc.mockResolvedValue({});

      const result = await deletionService.deleteProject(mockClient, projectId, {
        force: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.deletedCounts).toEqual({
        issues: 2,
        components: 1,
        milestones: 1,
        templates: 1,
      });
      expect(mockClient.deleteDoc).toHaveBeenCalledTimes(6); // project + 5 entities
    });

    it('should perform project deletion dry run', async () => {
      const projectId = 'PROJ';

      // Mock project exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
      });

      // Mock related entities
      mockClient.findAll
        .mockResolvedValueOnce([{ _id: 'issue-1' }]) // issues
        .mockResolvedValueOnce([]) // components
        .mockResolvedValueOnce([]) // milestones
        .mockResolvedValueOnce([]); // templates

      const result = await deletionService.deleteProject(mockClient, projectId, {
        dryRun: true,
      });

      expect(result.deleted).toBe(false);
      expect(result.dryRun).toBe(true);
      expect(result.wouldDelete.issues).toBe(1);
      expect(mockClient.deleteDoc).not.toHaveBeenCalled();
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

      // Mock issues using component
      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'issue-1', identifier: 'PROJ-1', component: 'comp-1' },
        { _id: 'issue-2', identifier: 'PROJ-2', component: 'comp-1' },
      ]);

      // Mock updates and deletion
      mockClient.updateDoc.mockResolvedValue({});
      mockClient.deleteDoc.mockResolvedValue({});

      const result = await deletionService.deleteComponent(mockClient, projectId, componentLabel, {
        removeFromIssues: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.affectedIssues).toBe(2);
      expect(mockClient.updateDoc).toHaveBeenCalledTimes(2);
      expect(mockClient.deleteDoc).toHaveBeenCalledWith('comp-1');
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
      mockClient.deleteDoc.mockResolvedValue({});

      const result = await deletionService.deleteComponent(mockClient, projectId, componentLabel, {
        force: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.forced).toBe(true);
      expect(mockClient.updateDoc).not.toHaveBeenCalled();
      expect(mockClient.deleteDoc).toHaveBeenCalledWith('comp-1');
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

      // Mock issues using milestone
      mockClient.findAll.mockResolvedValueOnce([
        { _id: 'issue-1', identifier: 'PROJ-1', milestone: 'milestone-1' },
      ]);

      // Mock updates and deletion
      mockClient.updateDoc.mockResolvedValue({});
      mockClient.deleteDoc.mockResolvedValue({});

      const result = await deletionService.deleteMilestone(mockClient, projectId, milestoneLabel, {
        removeFromIssues: true,
      });

      expect(result.deleted).toBe(true);
      expect(result.affectedIssues).toBe(1);
      expect(mockClient.updateDoc).toHaveBeenCalledTimes(1);
      expect(mockClient.deleteDoc).toHaveBeenCalledWith('milestone-1');
    });
  });

  describe('archiveProject', () => {
    it('should archive project', async () => {
      const projectId = 'PROJ';

      // Mock project exists and is not archived
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
        archived: false,
      });

      // Mock update
      mockClient.updateDoc.mockResolvedValue({});

      const result = await deletionService.archiveProject(mockClient, projectId);

      expect(result.archived).toBe(true);
      expect(mockClient.updateDoc).toHaveBeenCalledWith(projectId, { archived: true });
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

  describe('generateDeletionPreview', () => {
    it('should generate detailed deletion preview for project', async () => {
      const projectId = 'PROJ';

      // Mock project exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
      });

      // Mock related entities with details
      mockClient.findAll
        .mockResolvedValueOnce([
          { _id: 'issue-1', identifier: 'PROJ-1', title: 'Bug fix' },
          { _id: 'issue-2', identifier: 'PROJ-2', title: 'Feature' },
        ]) // issues
        .mockResolvedValueOnce([{ _id: 'comp-1', label: 'Frontend' }]) // components
        .mockResolvedValueOnce([{ _id: 'milestone-1', label: 'v1.0' }]) // milestones
        .mockResolvedValueOnce([{ _id: 'template-1', title: 'Bug Template' }]); // templates

      const preview = await deletionService.generateDeletionPreview(
        mockClient,
        'project',
        projectId,
        { detailed: true }
      );

      expect(preview.entity.type).toBe('project');
      expect(preview.entity.identifier).toBe(projectId);
      expect(preview.impact.total).toBe(5); // project + 4 entities
      expect(preview.impact.byType.issues).toBe(2);
      expect(preview.impact.byType.components).toBe(1);
      expect(preview.impact.byType.milestones).toBe(1);
      expect(preview.impact.byType.templates).toBe(1);
      expect(preview.entities.issues).toHaveLength(2);
      expect(preview.entities.issues[0]).toHaveProperty('identifier', 'PROJ-1');
    });

    it('should generate summary preview without entity details', async () => {
      const projectId = 'PROJ';

      // Mock project exists
      mockClient.findOne.mockResolvedValueOnce({
        _id: projectId,
        identifier: projectId,
        name: 'Test Project',
      });

      // Mock related entities
      mockClient.findAll
        .mockResolvedValueOnce([{ _id: 'issue-1' }]) // issues
        .mockResolvedValueOnce([]) // components
        .mockResolvedValueOnce([]) // milestones
        .mockResolvedValueOnce([]); // templates

      const preview = await deletionService.generateDeletionPreview(
        mockClient,
        'project',
        projectId,
        { detailed: false }
      );

      expect(preview.impact.total).toBe(2); // project + 1 issue
      expect(preview.entities).toBeUndefined();
    });
  });
});
