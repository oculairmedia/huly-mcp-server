import { jest } from '@jest/globals';
import { handler as validateDeletionHandler } from '../../../src/tools/validation/validateDeletion.js';

describe('validateDeletion tool', () => {
  let mockContext;
  let mockDeletionService;

  beforeEach(() => {
    mockDeletionService = {
      validateIssueDelete: jest.fn(),
      validateProjectDelete: jest.fn(),
      validateComponentDelete: jest.fn(),
      validateMilestoneDelete: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        deletionService: mockDeletionService,
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('issue validation', () => {
    it('should validate deletable issue', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      const mockValidation = {
        canDelete: true,
        name: 'Test Issue',
        blockers: [],
        warnings: [],
        dependencies: {},
        impact: {},
      };

      mockDeletionService.validateIssueDelete.mockResolvedValue(mockValidation);

      const result = await validateDeletionHandler(args, mockContext);

      expect(mockDeletionService.validateIssueDelete).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123'
      );
      expect(result).toContain('✅ Yes');
      expect(result).toContain('Test Issue');
    });

    it('should show blockers for undeletable issue', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      const mockValidation = {
        canDelete: false,
        name: 'Blocked Issue',
        blockers: ['Issue is referenced by PROJ-456', 'Issue has active pull request'],
        warnings: [],
        dependencies: {},
        impact: {},
      };

      mockDeletionService.validateIssueDelete.mockResolvedValue(mockValidation);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result).toContain('❌ No');
      expect(result).toContain('⚠️ Blockers');
      expect(result).toContain('Issue is referenced by PROJ-456');
      expect(result).toContain('Issue has active pull request');
    });

    it('should show warnings for issue with dependencies', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      const mockValidation = {
        canDelete: true,
        name: 'Issue with Dependencies',
        blockers: [],
        warnings: ['Has 3 sub-issues that will be deleted', 'Has 5 comments'],
        dependencies: {
          subIssues: [
            { identifier: 'PROJ-124', title: 'Sub 1' },
            { identifier: 'PROJ-125', title: 'Sub 2' },
            { identifier: 'PROJ-126', title: 'Sub 3' },
          ],
        },
        impact: {},
      };

      mockDeletionService.validateIssueDelete.mockResolvedValue(mockValidation);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result).toContain('✅ Yes');
      expect(result).toContain('⚠️ Warnings');
      expect(result).toContain('Has 3 sub-issues that will be deleted');
      expect(result).toContain('Has 5 comments');
    });

    it('should handle invalid issue identifier', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'invalid-format',
      };

      await expect(validateDeletionHandler(args, mockContext)).rejects.toThrow(
        'Invalid issue identifier format'
      );
    });
  });

  describe('project validation', () => {
    it('should validate empty project', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJ',
      };

      const mockValidation = {
        canDelete: true,
        name: 'Empty Project',
        blockers: [],
        warnings: [],
        dependencies: {},
        impact: {
          issues: 0,
          components: 0,
          milestones: 0,
          templates: 0,
        },
      };

      mockDeletionService.validateProjectDelete.mockResolvedValue(mockValidation);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result).toContain('✅ Yes');
      expect(result).toContain('Empty Project');
    });

    it('should show impact summary for project with data', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJ',
      };

      const mockValidation = {
        canDelete: false,
        name: 'Active Project',
        blockers: ['Project has active issues', 'Project has GitHub integration enabled'],
        warnings: [
          'Has 150 issues that will be deleted',
          'Has 10 components that will be deleted',
          'Has 5 milestones that will be deleted',
        ],
        dependencies: {},
        impact: {
          issues: 150,
          components: 10,
          milestones: 5,
          templates: 2,
        },
      };

      mockDeletionService.validateProjectDelete.mockResolvedValue(mockValidation);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result).toContain('❌ No');
      expect(result).toContain('📊 Impact Summary');
      expect(result).toContain('issues: 150');
      expect(result).toContain('components: 10');
      expect(result).toContain('milestones: 5');
      expect(result).toContain('templates: 2');
    });
  });

  describe('component validation', () => {
    it('should validate component deletion', async () => {
      const args = {
        entity_type: 'component',
        entity_identifier: 'Backend',
        project_identifier: 'PROJ',
      };

      const mockValidation = {
        canDelete: true,
        name: 'Backend Component',
        blockers: [],
        warnings: ['5 issues will have their component cleared'],
        dependencies: {
          issues: [
            { identifier: 'PROJ-1', title: 'Issue 1' },
            { identifier: 'PROJ-2', title: 'Issue 2' },
            { identifier: 'PROJ-3', title: 'Issue 3' },
            { identifier: 'PROJ-4', title: 'Issue 4' },
            { identifier: 'PROJ-5', title: 'Issue 5' },
          ],
        },
        impact: {
          issues: 5,
        },
      };

      mockDeletionService.validateComponentDelete.mockResolvedValue(mockValidation);

      const result = await validateDeletionHandler(args, mockContext);

      expect(mockDeletionService.validateComponentDelete).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Backend'
      );
      expect(result).toContain('✅ Yes');
      expect(result).toContain('5 issues will have their component cleared');
      expect(result).toContain('issues: 5');
    });

    it('should require project identifier for component', async () => {
      const args = {
        entity_type: 'component',
        entity_identifier: 'Backend',
      };

      await expect(validateDeletionHandler(args, mockContext)).rejects.toThrow(
        'project_identifier is required for component validation'
      );
    });
  });

  describe('milestone validation', () => {
    it('should validate milestone deletion', async () => {
      const args = {
        entity_type: 'milestone',
        entity_identifier: 'v1.0',
        project_identifier: 'PROJ',
      };

      const mockValidation = {
        canDelete: true,
        name: 'Version 1.0',
        blockers: [],
        warnings: ['10 issues will have their milestone cleared'],
        dependencies: {
          issues: Array.from({ length: 10 }, (_, i) => ({
            identifier: `PROJ-${i + 1}`,
            title: `Issue ${i + 1}`,
          })),
        },
        impact: {
          issues: 10,
        },
      };

      mockDeletionService.validateMilestoneDelete.mockResolvedValue(mockValidation);

      const result = await validateDeletionHandler(args, mockContext);

      expect(mockDeletionService.validateMilestoneDelete).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'v1.0'
      );
      expect(result).toContain('✅ Yes');
      expect(result).toContain('10 issues will have their milestone cleared');
    });

    it('should require project identifier for milestone', async () => {
      const args = {
        entity_type: 'milestone',
        entity_identifier: 'v1.0',
      };

      await expect(validateDeletionHandler(args, mockContext)).rejects.toThrow(
        'project_identifier is required for milestone validation'
      );
    });
  });

  it('should handle unknown entity type', async () => {
    const args = {
      entity_type: 'unknown',
      entity_identifier: 'something',
    };

    await expect(validateDeletionHandler(args, mockContext)).rejects.toThrow(
      'Unknown entity type: unknown'
    );
  });

  it('should handle validation errors', async () => {
    const args = {
      entity_type: 'issue',
      entity_identifier: 'PROJ-123',
    };

    mockDeletionService.validateIssueDelete.mockRejectedValue(new Error('Database error'));

    await expect(validateDeletionHandler(args, mockContext)).rejects.toThrow('Database error');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});
