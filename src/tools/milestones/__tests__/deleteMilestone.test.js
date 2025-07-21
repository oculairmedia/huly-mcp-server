/**
 * Unit tests for deleteMilestone tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../deleteMilestone.js';

describe('deleteMilestone tool', () => {
  let mockContext;
  let mockMilestoneService;

  beforeEach(() => {
    mockMilestoneService = {
      deleteMilestone: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        milestoneService: mockMilestoneService,
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

  describe('definition', () => {
    it('should have correct tool definition', () => {
      expect(definition.name).toBe('huly_delete_milestone');
      expect(definition.description).toContain('Delete a milestone');
      expect(definition.inputSchema.required).toEqual(['project_identifier', 'milestone_label']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should delete milestone successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Deleted milestone "v1.0" from project PROJ',
          },
        ],
      };

      mockMilestoneService.deleteMilestone.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockMilestoneService.deleteMilestone).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'v1.0',
        {
          dry_run: false,
          force: false,
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle dry run mode', async () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
        dry_run: true,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: `🔍 DRY RUN: Would delete milestone "v1.0"

Affected issues: 15
- PROJ-1: Feature implementation
- PROJ-2: Bug fix
- PROJ-3: Documentation update
...

Total issues that would be affected: 15`,
          },
        ],
      };

      mockMilestoneService.deleteMilestone.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockMilestoneService.deleteMilestone).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'v1.0',
        {
          dry_run: true,
          force: false,
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle force deletion', async () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
        force: true,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Force deleted milestone "v1.0" from project PROJ\nRemoved from 20 issues',
          },
        ],
      };

      mockMilestoneService.deleteMilestone.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockMilestoneService.deleteMilestone).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'v1.0',
        {
          dry_run: false,
          force: true,
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle milestone not found error', async () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v99.0',
      };

      const error = new Error('Milestone "v99.0" not found in project PROJ');
      mockMilestoneService.deleteMilestone.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle milestone in use error', async () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
      };

      const error = new Error('Milestone is in use by 10 issues. Use force=true to delete anyway.');
      mockMilestoneService.deleteMilestone.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
      };

      const error = new Error('Failed to delete milestone');
      mockMilestoneService.deleteMilestone.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to delete milestone:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all options', () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
        dry_run: true,
        force: false,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without project identifier', () => {
      const args = {
        milestone_label: 'v1.0',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
        milestone_label: 'v1.0',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with invalid project identifier format', () => {
      const args = {
        project_identifier: 'proj-123',
        milestone_label: 'v1.0',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });

    it('should fail validation without milestone label', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('milestone_label');
    });

    it('should fail validation with empty milestone label', () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('milestone_label');
      expect(errors.milestone_label).toContain('required');
    });

    it('should fail validation with non-boolean dry_run', () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
        dry_run: 'yes',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('dry_run');
      expect(errors.dry_run).toContain('boolean');
    });

    it('should fail validation with non-boolean force', () => {
      const args = {
        project_identifier: 'PROJ',
        milestone_label: 'v1.0',
        force: 1,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('force');
      expect(errors.force).toContain('boolean');
    });
  });
});
