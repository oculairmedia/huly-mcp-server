import { jest } from '@jest/globals';
import { handler as validateDeletionHandler } from '../../../src/tools/validation/validateDeletion.js';

describe('validateDeletion tool', () => {
  let mockContext;
  let mockDeletionService;

  beforeEach(() => {
    mockDeletionService = {
      analyzeIssueDeletionImpact: jest.fn(),
      analyzeProjectDeletionImpact: jest.fn(),
      deleteComponent: jest.fn(),
      deleteMilestone: jest.fn(),
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

      const mockImpact = {
        issue: {
          title: 'Test Issue',
        },
        blockers: [],
        subIssues: [],
        comments: 0,
        attachments: 0,
      };

      mockDeletionService.analyzeIssueDeletionImpact.mockResolvedValue(mockImpact);

      const result = await validateDeletionHandler(args, mockContext);

      expect(mockDeletionService.analyzeIssueDeletionImpact).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ-123'
      );
      expect(result.content[0].text).toContain('✅ Yes');
      expect(result.content[0].text).toContain('Test Issue');
    });

    it('should show blockers for undeletable issue', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      const mockImpact = {
        issue: {
          title: 'Blocked Issue',
        },
        blockers: ['Issue is referenced by PROJ-456', 'Issue has active pull request'],
        subIssues: [],
        comments: 0,
        attachments: 0,
      };

      mockDeletionService.analyzeIssueDeletionImpact.mockResolvedValue(mockImpact);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result.content[0].text).toContain('❌ No');
      expect(result.content[0].text).toContain('⚠️ Blockers');
      expect(result.content[0].text).toContain('Issue is referenced by PROJ-456');
      expect(result.content[0].text).toContain('Issue has active pull request');
    });

    it('should show warnings for issue with dependencies', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      const mockImpact = {
        issue: {
          title: 'Issue with Dependencies',
        },
        blockers: [],
        subIssues: [
          { identifier: 'PROJ-124', title: 'Sub 1' },
          { identifier: 'PROJ-125', title: 'Sub 2' },
          { identifier: 'PROJ-126', title: 'Sub 3' },
        ],
        comments: 5,
        attachments: 0,
      };

      mockDeletionService.analyzeIssueDeletionImpact.mockResolvedValue(mockImpact);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result.content[0].text).toContain('✅ Yes');
      expect(result.content[0].text).toContain('⚠️ Warnings');
      expect(result.content[0].text).toContain('Has 3 sub-issues that will be deleted');
      expect(result.content[0].text).toContain('Has 5 comments that will be deleted');
    });

    it('should handle invalid issue identifier', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'invalid-format',
      };

      const result = await validateDeletionHandler(args, mockContext);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Invalid value');
    });
  });

  describe('project validation', () => {
    it('should validate empty project', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJ',
      };

      const mockImpact = {
        project: {
          name: 'Empty Project',
        },
        blockers: [],
        issues: [],
        components: [],
        milestones: [],
        templates: [],
      };

      mockDeletionService.analyzeProjectDeletionImpact.mockResolvedValue(mockImpact);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result.content[0].text).toContain('✅ Yes');
      expect(result.content[0].text).toContain('Empty Project');
    });

    it('should show impact summary for project with data', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJ',
      };

      const mockImpact = {
        project: {
          name: 'Active Project',
        },
        blockers: ['Project has active issues', 'Project has GitHub integration enabled'],
        issues: new Array(150).fill({ id: 'test' }),
        components: new Array(10).fill({ id: 'test' }),
        milestones: new Array(5).fill({ id: 'test' }),
        templates: new Array(2).fill({ id: 'test' }),
      };

      mockDeletionService.analyzeProjectDeletionImpact.mockResolvedValue(mockImpact);

      const result = await validateDeletionHandler(args, mockContext);

      expect(result.content[0].text).toContain('❌ No');
      expect(result.content[0].text).toContain('📊 Impact Summary');
      expect(result.content[0].text).toContain('issues: 150');
      expect(result.content[0].text).toContain('components: 10');
      expect(result.content[0].text).toContain('milestones: 5');
      expect(result.content[0].text).toContain('templates: 2');
    });
  });

  describe('component validation', () => {
    it('should validate component deletion', async () => {
      const args = {
        entity_type: 'component',
        entity_identifier: 'Backend',
        project_identifier: 'PROJ',
      };

      const mockDryRunResult = {
        content: [
          {
            type: 'text',
            text: '🔍 DRY RUN: Would delete component "Backend"\n\nAffected issues: 5\n- PROJ-1: Issue 1\n- PROJ-2: Issue 2\n- PROJ-3: Issue 3\n- PROJ-4: Issue 4\n- PROJ-5: Issue 5',
          },
        ],
      };

      mockDeletionService.deleteComponent.mockResolvedValue(mockDryRunResult);

      const result = await validateDeletionHandler(args, mockContext);

      expect(mockDeletionService.deleteComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Backend',
        { dryRun: true }
      );
      expect(result.content[0].text).toContain('❌ No');
      expect(result.content[0].text).toContain('5 issues use this component');
      expect(result.content[0].text).toContain('affected issues: 5');
    });

    it('should require project identifier for component', async () => {
      const args = {
        entity_type: 'component',
        entity_identifier: 'Backend',
      };

      const result = await validateDeletionHandler(args, mockContext);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('project_identifier');
    });
  });

  describe('milestone validation', () => {
    it('should validate milestone deletion', async () => {
      const args = {
        entity_type: 'milestone',
        entity_identifier: 'v1.0',
        project_identifier: 'PROJ',
      };

      const mockDryRunResult = {
        content: [
          {
            type: 'text',
            text: '🔍 DRY RUN: Would delete milestone "v1.0"\n\nAffected issues: 10\n- PROJ-1: Issue 1\n- PROJ-2: Issue 2\n[...and more]',
          },
        ],
      };

      mockDeletionService.deleteMilestone.mockResolvedValue(mockDryRunResult);

      const result = await validateDeletionHandler(args, mockContext);

      expect(mockDeletionService.deleteMilestone).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'v1.0',
        { dryRun: true }
      );
      expect(result.content[0].text).toContain('❌ No');
      expect(result.content[0].text).toContain('10 issues use this milestone');
    });

    it('should require project identifier for milestone', async () => {
      const args = {
        entity_type: 'milestone',
        entity_identifier: 'v1.0',
      };

      const result = await validateDeletionHandler(args, mockContext);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('project_identifier');
    });
  });

  it('should handle unknown entity type', async () => {
    const args = {
      entity_type: 'unknown',
      entity_identifier: 'something',
    };

    const result = await validateDeletionHandler(args, mockContext);
    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain('entity_type');
  });

  it('should handle validation errors', async () => {
    const args = {
      entity_type: 'issue',
      entity_identifier: 'PROJ-123',
    };

    mockDeletionService.analyzeIssueDeletionImpact.mockRejectedValue(new Error('Database error'));

    const result = await validateDeletionHandler(args, mockContext);
    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain('Database error');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });
});
