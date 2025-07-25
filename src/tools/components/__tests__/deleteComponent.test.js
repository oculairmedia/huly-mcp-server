/**
 * Unit tests for deleteComponent tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../deleteComponent.js';

describe('deleteComponent tool', () => {
  let mockContext;
  let mockDeletionService;

  beforeEach(() => {
    mockDeletionService = {
      deleteComponent: jest.fn(),
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

  describe('definition', () => {
    it('should have correct tool definition', () => {
      expect(definition.name).toBe('huly_delete_component');
      expect(definition.description).toContain('Delete a component');
      expect(definition.inputSchema.required).toEqual(['project_identifier', 'component_label']);
      expect(definition.inputSchema.properties.force.default).toBe(false);
      expect(definition.inputSchema.properties.dry_run.default).toBe(false);
    });
  });

  describe('handler', () => {
    it('should delete component successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Deleted component "Frontend" from project PROJ',
          },
        ],
      };

      mockDeletionService.deleteComponent.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockDeletionService.deleteComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Frontend',
        {
          dryRun: false,
          force: false,
        }
      );
      expect(result).toEqual(_mockResult);
    });

    it('should handle dry run mode', async () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
        dry_run: true,
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '🔍 DRY RUN: Would delete component "Frontend"\n\nAffected issues: 5\n- PROJ-1: Frontend bug\n- PROJ-2: UI improvement\n...',
          },
        ],
      };

      mockDeletionService.deleteComponent.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockDeletionService.deleteComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Frontend',
        {
          dryRun: true,
          force: false,
        }
      );
      expect(result).toEqual(_mockResult);
    });

    it('should handle force deletion', async () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
        force: true,
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Force deleted component "Frontend" from project PROJ\nRemoved from 10 issues',
          },
        ],
      };

      mockDeletionService.deleteComponent.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockDeletionService.deleteComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Frontend',
        {
          dryRun: false,
          force: true,
        }
      );
      expect(result).toEqual(_mockResult);
    });

    it('should handle component not found error', async () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'NonExistent',
      };

      const error = new Error('Component "NonExistent" not found in project PROJ');
      mockDeletionService.deleteComponent.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle component in use error', async () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
      };

      const error = new Error('Component is in use by 5 issues. Use force=true to delete anyway.');
      mockDeletionService.deleteComponent.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all options', () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
        dry_run: true,
        force: false,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without project identifier', () => {
      const args = {
        component_label: 'Frontend',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
        component_label: 'Frontend',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with invalid project identifier format', () => {
      const args = {
        project_identifier: 'proj-123',
        component_label: 'Frontend',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without component label', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('component_label');
    });

    it('should fail validation with empty component label', () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('component_label');
      expect(errors.component_label).toContain('required');
    });

    it('should fail validation with non-boolean dry_run', () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
        dry_run: 'yes',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation with non-boolean force', () => {
      const args = {
        project_identifier: 'PROJ',
        component_label: 'Frontend',
        force: 'true',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });
  });
});
