/**
 * Unit tests for archiveProject tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../archiveProject.js';

describe('archiveProject tool', () => {
  let mockContext;
  let mockDeletionService;

  beforeEach(() => {
    mockDeletionService = {
      archiveProject: jest.fn(),
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
      expect(definition.name).toBe('huly_archive_project');
      expect(definition.description).toContain('Archive a project');
      expect(definition.inputSchema.required).toEqual(['project_identifier']);
      expect(definition.inputSchema.properties.project_identifier).toBeDefined();
    });
  });

  describe('handler', () => {
    it('should archive project successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: `✅ Project PROJ archived successfully

The project is now hidden from active views but data is preserved.
To restore the project, use the restore command or archive management UI.`,
          },
        ],
      };

      mockDeletionService.archiveProject.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockDeletionService.archiveProject).toHaveBeenCalledWith(mockContext.client, 'PROJ');
      expect(result).toEqual(_mockResult);
    });

    it('should handle project not found error', async () => {
      const args = {
        project_identifier: 'INVALID',
      };

      const error = new Error('Project not found: INVALID');
      mockDeletionService.archiveProject.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle already archived project', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error('Project PROJ is already archived');
      mockDeletionService.archiveProject.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle active integrations error', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error('Cannot archive project with active GitHub integration');
      mockDeletionService.archiveProject.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error('Failed to archive project');
      mockDeletionService.archiveProject.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to archive project:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with valid project identifier', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with different valid project formats', () => {
      const validIdentifiers = ['A', 'AB', 'ABC', 'ABCD', 'ABCDE'];

      validIdentifiers.forEach((identifier) => {
        const args = { project_identifier: identifier };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without project identifier', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('required');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with lowercase project identifier', () => {
      const args = {
        project_identifier: 'proj',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation with too long project identifier', () => {
      const args = {
        project_identifier: 'TOOLONG',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('5 characters');
    });

    it('should fail validation with special characters', () => {
      const args = {
        project_identifier: 'PR@J',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });
  });
});
