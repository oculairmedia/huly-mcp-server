/**
 * Unit tests for listComponents tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../listComponents.js';

describe('listComponents tool', () => {
  let mockContext;
  let mockProjectService;

  beforeEach(() => {
    mockProjectService = {
      listComponents: jest.fn(),
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
      expect(definition.name).toBe('huly_list_components');
      expect(definition.description).toContain('List all components');
      expect(definition.inputSchema.required).toEqual(['project_identifier']);
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should list components successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: `## Components in PROJ

### Frontend
Description: User interface components
Issues: 15

### Backend
Description: Server-side services
Issues: 23

### Database
Description: Data storage and migrations
Issues: 8

Total components: 3`,
          },
        ],
      };

      mockProjectService.listComponents.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.listComponents).toHaveBeenCalledWith(mockContext.client, 'PROJ');
      expect(result).toEqual(_mockResult);
    });

    it('should handle empty components list', async () => {
      const args = {
        project_identifier: 'NEWPROJ',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: 'No components found in project NEWPROJ',
          },
        ],
      };

      mockProjectService.listComponents.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.listComponents).toHaveBeenCalledWith(mockContext.client, 'NEWPROJ');
      expect(result).toEqual(_mockResult);
    });

    it('should handle project not found error', async () => {
      const args = {
        project_identifier: 'INVALID',
      };

      const error = new Error('Project not found: INVALID');
      mockProjectService.listComponents.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error('Failed to list components');
      mockProjectService.listComponents.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to list components:', error);
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

    it('should pass validation with lowercase project identifier', () => {
      const args = {
        project_identifier: 'proj',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with mixed case project identifier', () => {
      const args = {
        project_identifier: 'Proj',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with long project identifier', () => {
      const args = {
        project_identifier: 'TOOLONG',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with special characters', () => {
      const args = {
        project_identifier: 'PR-OJ',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });
  });
});
