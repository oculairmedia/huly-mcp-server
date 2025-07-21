/**
 * Unit tests for deleteProject tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../deleteProject.js';

describe('deleteProject tool', () => {
  let mockContext;
  let mockProjectService;

  beforeEach(() => {
    mockProjectService = {
      deleteProject: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        projectService: mockProjectService,
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
      expect(definition.name).toBe('huly_delete_project');
      expect(definition.description).toContain('Delete an entire project');
      expect(definition.inputSchema.required).toEqual(['project_identifier']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should delete project successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: `✅ Successfully deleted project PROJ

Deleted:
- 45 issues (including 12 sub-issues)
- 5 components
- 3 milestones
- 8 templates

All project data has been permanently removed.`,
          },
        ],
      };

      mockProjectService.deleteProject.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith(mockContext.client, 'PROJ', {
        dry_run: false,
        force: false,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle dry run mode', async () => {
      const args = {
        project_identifier: 'PROJ',
        dry_run: true,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: `🔍 DRY RUN: Project deletion preview for PROJ

Would delete:
- 45 issues (including 12 sub-issues)
- 5 components
- 3 milestones
- 8 templates
- 2 GitHub integrations

⚠️ This action is irreversible. Use force=true to proceed with actual deletion.`,
          },
        ],
      };

      mockProjectService.deleteProject.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith(mockContext.client, 'PROJ', {
        dry_run: true,
        force: false,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle force deletion', async () => {
      const args = {
        project_identifier: 'PROJ',
        force: true,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Force deleted project PROJ and all associated data',
          },
        ],
      };

      mockProjectService.deleteProject.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith(mockContext.client, 'PROJ', {
        dry_run: false,
        force: true,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle project not found error', async () => {
      const args = {
        project_identifier: 'INVALID',
      };

      const error = new Error('Project not found: INVALID');
      mockProjectService.deleteProject.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle active integrations error', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error(
        'Cannot delete project with active integrations. Use force=true to override.'
      );
      mockProjectService.deleteProject.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error('Failed to delete project');
      mockProjectService.deleteProject.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to delete project:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all options', () => {
      const args = {
        project_identifier: 'PROJ',
        dry_run: true,
        force: false,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without project identifier', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with invalid project identifier format', () => {
      const args = {
        project_identifier: 'proj-123',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });

    it('should fail validation with non-boolean dry_run', () => {
      const args = {
        project_identifier: 'PROJ',
        dry_run: 'yes',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('dry_run');
      expect(errors.dry_run).toContain('boolean');
    });

    it('should fail validation with non-boolean force', () => {
      const args = {
        project_identifier: 'PROJ',
        force: 1,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('force');
      expect(errors.force).toContain('boolean');
    });

    it('should fail validation with number project identifier', () => {
      const args = {
        project_identifier: 123,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('string');
    });
  });
});
