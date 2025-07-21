import { jest } from '@jest/globals';
import DeletionService from '../../src/services/DeletionService.js';
import { createLoggerWithConfig } from '../../src/utils/logger.js';

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  createLoggerWithConfig: jest.fn(),
}));

describe('DeletionService', () => {
  let deletionService;
  let mockClient;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    createLoggerWithConfig.mockReturnValue(mockLogger);

    mockClient = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      removeDoc: jest.fn(),
      removeCollection: jest.fn(),
      update: jest.fn(),
    };

    deletionService = new DeletionService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteIssue', () => {
    const issueIdentifier = 'PROJ-123';
    const mockIssue = {
      _id: 'issue-123',
      _class: 'tracker:class:Issue',
      identifier: issueIdentifier,
      title: 'Test Issue',
    };

    it('should delete a simple issue without sub-issues', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll.mockResolvedValue([]); // No sub-issues
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteIssue(mockClient, issueIdentifier);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
      expect(result.deletedIssues).toEqual([issueIdentifier]);
      expect(mockClient.removeDoc).toHaveBeenCalledWith(mockIssue._class, mockIssue._id);
    });

    it('should delete issue with cascade including sub-issues', async () => {
      const subIssue = {
        _id: 'sub-issue-123',
        _class: 'tracker:class:Issue',
        identifier: 'PROJ-124',
        title: 'Sub Issue',
        parentIssue: mockIssue._id,
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll.mockResolvedValueOnce([subIssue]); // Sub-issues
      mockClient.findAll.mockResolvedValueOnce([]); // No sub-sub-issues
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteIssue(mockClient, issueIdentifier, {
        cascade: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.deletedIssues).toEqual([issueIdentifier, 'PROJ-124']);
      expect(mockClient.removeDoc).toHaveBeenCalledTimes(2);
    });

    it('should not delete sub-issues when cascade is false', async () => {
      const subIssue = {
        _id: 'sub-issue-123',
        _class: 'tracker:class:Issue',
        identifier: 'PROJ-124',
        title: 'Sub Issue',
        parentIssue: mockIssue._id,
      };

      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll.mockResolvedValueOnce([subIssue]); // Sub-issues
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteIssue(mockClient, issueIdentifier, {
        cascade: false,
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
      expect(result.deletedIssues).toEqual([issueIdentifier]);
      expect(result.warnings).toContain('Issue has 1 sub-issues that were not deleted');
      expect(mockClient.removeDoc).toHaveBeenCalledTimes(1);
    });

    it('should perform dry run without actual deletion', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll.mockResolvedValue([]);

      const result = await deletionService.deleteIssue(mockClient, issueIdentifier, {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.wouldDelete).toEqual([issueIdentifier]);
      expect(result.dryRun).toBe(true);
      expect(mockClient.removeDoc).not.toHaveBeenCalled();
    });

    it('should handle issue not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(deletionService.deleteIssue(mockClient, issueIdentifier)).rejects.toThrow(
        'Issue not found: PROJ-123'
      );
    });

    it('should force delete when blockers exist', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockIssue);
      mockClient.findAll.mockResolvedValue([]);
      mockClient.removeDoc.mockResolvedValue(true);

      // Mock validation to return blockers
      deletionService.validateIssueDelete = jest.fn().mockResolvedValue({
        canDelete: false,
        blockers: ['Issue is referenced by another issue'],
      });

      const result = await deletionService.deleteIssue(mockClient, issueIdentifier, {
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.forcedDeletion).toBe(true);
      expect(mockClient.removeDoc).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    const projectIdentifier = 'PROJ';
    const mockProject = {
      _id: 'project-123',
      _class: 'tracker:class:Project',
      identifier: projectIdentifier,
      name: 'Test Project',
    };

    it('should delete empty project', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll.mockResolvedValue([]); // No issues, components, milestones, templates
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteProject(mockClient, projectIdentifier);

      expect(result.success).toBe(true);
      expect(result.project).toBe(projectIdentifier);
      expect(result.deleted).toEqual({
        project: true,
        issues: 0,
        components: 0,
        milestones: 0,
        templates: 0,
      });
      expect(mockClient.removeDoc).toHaveBeenCalledWith(mockProject._class, mockProject._id);
    });

    it('should delete project with all related entities', async () => {
      const mockIssue = {
        _id: 'issue-1',
        _class: 'tracker:class:Issue',
        identifier: 'PROJ-1',
        title: 'Issue 1',
      };
      const mockComponent = {
        _id: 'comp-1',
        _class: 'tracker:class:Component',
        label: 'Component 1',
      };
      const mockMilestone = {
        _id: 'mile-1',
        _class: 'tracker:class:Milestone',
        label: 'Milestone 1',
      };
      const mockTemplate = {
        _id: 'template-1',
        _class: 'tracker:class:IssueTemplate',
        title: 'Template 1',
      };

      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll
        .mockResolvedValueOnce([mockIssue]) // Issues
        .mockResolvedValueOnce([]) // No sub-issues
        .mockResolvedValueOnce([mockComponent]) // Components
        .mockResolvedValueOnce([mockMilestone]) // Milestones
        .mockResolvedValueOnce([mockTemplate]); // Templates
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteProject(mockClient, projectIdentifier);

      expect(result.success).toBe(true);
      expect(result.deleted).toEqual({
        project: true,
        issues: 1,
        components: 1,
        milestones: 1,
        templates: 1,
      });
      expect(mockClient.removeDoc).toHaveBeenCalledTimes(5); // project + 4 entities
    });

    it('should perform dry run for project deletion', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll.mockResolvedValue([]);

      const result = await deletionService.deleteProject(mockClient, projectIdentifier, {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.wouldDelete).toEqual({
        project: projectIdentifier,
        issues: 0,
        components: 0,
        milestones: 0,
        templates: 0,
      });
      expect(mockClient.removeDoc).not.toHaveBeenCalled();
    });

    it('should force delete project with active issues', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll.mockResolvedValue([]);
      mockClient.removeDoc.mockResolvedValue(true);

      // Mock validation to return blockers
      deletionService.validateProjectDelete = jest.fn().mockResolvedValue({
        canDelete: false,
        blockers: ['Project has active issues'],
      });

      const result = await deletionService.deleteProject(mockClient, projectIdentifier, {
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.forcedDeletion).toBe(true);
      expect(mockClient.removeDoc).toHaveBeenCalled();
    });
  });

  describe('archiveProject', () => {
    const projectIdentifier = 'PROJ';
    const mockProject = {
      _id: 'project-123',
      _class: 'tracker:class:Project',
      identifier: projectIdentifier,
      name: 'Test Project',
      archived: false,
    };

    it('should archive active project', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.update.mockResolvedValue(true);

      const result = await deletionService.archiveProject(mockClient, projectIdentifier);

      expect(result.success).toBe(true);
      expect(result.project).toBe(projectIdentifier);
      expect(result.archived).toBe(true);
      expect(mockClient.update).toHaveBeenCalledWith(mockProject, { archived: true });
    });

    it('should handle already archived project', async () => {
      const archivedProject = { ...mockProject, archived: true };
      mockClient.findOne.mockResolvedValueOnce(archivedProject);

      const result = await deletionService.archiveProject(mockClient, projectIdentifier);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Project is already archived');
      expect(mockClient.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteComponent', () => {
    const projectIdentifier = 'PROJ';
    const componentLabel = 'Backend';
    const mockProject = {
      _id: 'project-123',
      _class: 'tracker:class:Project',
      identifier: projectIdentifier,
    };
    const mockComponent = {
      _id: 'comp-123',
      _class: 'tracker:class:Component',
      label: componentLabel,
      space: mockProject._id,
    };

    it('should delete component without issues', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject).mockResolvedValueOnce(mockComponent);
      mockClient.findAll.mockResolvedValue([]); // No issues
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteComponent(
        mockClient,
        projectIdentifier,
        componentLabel
      );

      expect(result.success).toBe(true);
      expect(result.component).toBe(componentLabel);
      expect(result.affectedIssues).toBe(0);
      expect(mockClient.removeDoc).toHaveBeenCalledWith(mockComponent._class, mockComponent._id);
    });

    it('should update issues when deleting component', async () => {
      const mockIssue = {
        _id: 'issue-1',
        _class: 'tracker:class:Issue',
        identifier: 'PROJ-1',
        component: mockComponent._id,
      };

      mockClient.findOne.mockResolvedValueOnce(mockProject).mockResolvedValueOnce(mockComponent);
      mockClient.findAll.mockResolvedValueOnce([mockIssue]);
      mockClient.update.mockResolvedValue(true);
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteComponent(
        mockClient,
        projectIdentifier,
        componentLabel
      );

      expect(result.success).toBe(true);
      expect(result.affectedIssues).toBe(1);
      expect(mockClient.update).toHaveBeenCalledWith(mockIssue, { component: null });
    });
  });

  describe('deleteMilestone', () => {
    const projectIdentifier = 'PROJ';
    const milestoneLabel = 'v1.0';
    const mockProject = {
      _id: 'project-123',
      _class: 'tracker:class:Project',
      identifier: projectIdentifier,
    };
    const mockMilestone = {
      _id: 'mile-123',
      _class: 'tracker:class:Milestone',
      label: milestoneLabel,
      space: mockProject._id,
    };

    it('should delete milestone without issues', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject).mockResolvedValueOnce(mockMilestone);
      mockClient.findAll.mockResolvedValue([]); // No issues
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteMilestone(
        mockClient,
        projectIdentifier,
        milestoneLabel
      );

      expect(result.success).toBe(true);
      expect(result.milestone).toBe(milestoneLabel);
      expect(result.affectedIssues).toBe(0);
      expect(mockClient.removeDoc).toHaveBeenCalledWith(mockMilestone._class, mockMilestone._id);
    });

    it('should update issues when deleting milestone', async () => {
      const mockIssue = {
        _id: 'issue-1',
        _class: 'tracker:class:Issue',
        identifier: 'PROJ-1',
        milestone: mockMilestone._id,
      };

      mockClient.findOne.mockResolvedValueOnce(mockProject).mockResolvedValueOnce(mockMilestone);
      mockClient.findAll.mockResolvedValueOnce([mockIssue]);
      mockClient.update.mockResolvedValue(true);
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.deleteMilestone(
        mockClient,
        projectIdentifier,
        milestoneLabel
      );

      expect(result.success).toBe(true);
      expect(result.affectedIssues).toBe(1);
      expect(mockClient.update).toHaveBeenCalledWith(mockIssue, { milestone: null });
    });
  });

  describe('bulkDeleteIssues', () => {
    const issueIdentifiers = ['PROJ-1', 'PROJ-2', 'PROJ-3'];
    const mockIssues = issueIdentifiers.map((id, idx) => ({
      _id: `issue-${idx}`,
      _class: 'tracker:class:Issue',
      identifier: id,
      title: `Issue ${idx + 1}`,
    }));

    it('should delete multiple issues successfully', async () => {
      mockIssues.forEach((issue) => {
        mockClient.findOne.mockResolvedValueOnce(issue);
        mockClient.findAll.mockResolvedValueOnce([]); // No sub-issues
      });
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.bulkDeleteIssues(mockClient, issueIdentifiers);

      expect(result.success).toBe(true);
      expect(result.totalRequested).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should continue on error when enabled', async () => {
      // First issue succeeds
      mockClient.findOne.mockResolvedValueOnce(mockIssues[0]);
      mockClient.findAll.mockResolvedValueOnce([]);
      mockClient.removeDoc.mockResolvedValueOnce(true);

      // Second issue fails
      mockClient.findOne.mockResolvedValueOnce(null);

      // Third issue succeeds
      mockClient.findOne.mockResolvedValueOnce(mockIssues[2]);
      mockClient.findAll.mockResolvedValueOnce([]);
      mockClient.removeDoc.mockResolvedValueOnce(true);

      const result = await deletionService.bulkDeleteIssues(mockClient, issueIdentifiers, {
        continueOnError: true,
      });

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('Issue not found');
    });

    it('should stop on error when continueOnError is false', async () => {
      // First issue succeeds
      mockClient.findOne.mockResolvedValueOnce(mockIssues[0]);
      mockClient.findAll.mockResolvedValueOnce([]);
      mockClient.removeDoc.mockResolvedValueOnce(true);

      // Second issue fails
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        deletionService.bulkDeleteIssues(mockClient, issueIdentifiers, {
          continueOnError: false,
        })
      ).rejects.toThrow('Issue not found: PROJ-2');
    });

    it('should respect batch size', async () => {
      mockIssues.forEach((issue) => {
        mockClient.findOne.mockResolvedValueOnce(issue);
        mockClient.findAll.mockResolvedValueOnce([]);
      });
      mockClient.removeDoc.mockResolvedValue(true);

      const result = await deletionService.bulkDeleteIssues(mockClient, issueIdentifiers, {
        batchSize: 2,
      });

      expect(result.success).toBe(true);
      expect(result.batches).toBe(2); // 3 items with batch size 2 = 2 batches
    });
  });

  describe('validation methods', () => {
    describe('validateIssueDelete', () => {
      const issueIdentifier = 'PROJ-123';
      const mockIssue = {
        _id: 'issue-123',
        _class: 'tracker:class:Issue',
        identifier: issueIdentifier,
        title: 'Test Issue',
      };

      it('should validate issue with no dependencies', async () => {
        mockClient.findOne.mockResolvedValueOnce(mockIssue);
        mockClient.findAll.mockResolvedValue([]);

        const result = await deletionService.validateIssueDelete(mockClient, issueIdentifier);

        expect(result.canDelete).toBe(true);
        expect(result.blockers).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should warn about sub-issues', async () => {
        const subIssue = {
          _id: 'sub-issue-123',
          identifier: 'PROJ-124',
          title: 'Sub Issue',
        };

        mockClient.findOne.mockResolvedValueOnce(mockIssue);
        mockClient.findAll.mockResolvedValueOnce([subIssue]);

        const result = await deletionService.validateIssueDelete(mockClient, issueIdentifier);

        expect(result.canDelete).toBe(true);
        expect(result.warnings).toContain('Has 1 sub-issues that will be deleted');
        expect(result.dependencies.subIssues).toHaveLength(1);
      });
    });

    describe('validateProjectDelete', () => {
      const projectIdentifier = 'PROJ';
      const mockProject = {
        _id: 'project-123',
        _class: 'tracker:class:Project',
        identifier: projectIdentifier,
        name: 'Test Project',
      };

      it('should validate empty project', async () => {
        mockClient.findOne.mockResolvedValueOnce(mockProject);
        mockClient.findAll.mockResolvedValue([]);

        const result = await deletionService.validateProjectDelete(mockClient, projectIdentifier);

        expect(result.canDelete).toBe(true);
        expect(result.blockers).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should block deletion with active issues', async () => {
        mockClient.findOne.mockResolvedValueOnce(mockProject);
        mockClient.findAll.mockResolvedValueOnce([{ _id: 'issue-1' }]); // Has issues

        const result = await deletionService.validateProjectDelete(mockClient, projectIdentifier);

        expect(result.canDelete).toBe(false);
        expect(result.blockers).toContain('Project has active issues');
        expect(result.impact.issues).toBe(1);
      });
    });
  });
});
