/**
 * Unit tests for createComponent tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../createComponent.js';

describe('createComponent tool', () => {
  let mockContext;
  let mockComponentService;

  beforeEach(() => {
    mockComponentService = {
      createComponent: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        componentService: mockComponentService,
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
      expect(definition.name).toBe('huly_create_component');
      expect(definition.description).toContain('Create a new component');
      expect(definition.inputSchema.required).toEqual(['project_identifier', 'label']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should create component successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
        label: 'Frontend',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Created component "Frontend" in project PROJ',
          },
        ],
      };

      mockComponentService.createComponent.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockComponentService.createComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Frontend',
        undefined
      );
      expect(result).toEqual(mockResult);
    });

    it('should create component with description', async () => {
      const args = {
        project_identifier: 'PROJ',
        label: 'Backend API',
        description: 'Core backend services and APIs',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Created component "Backend API" in project PROJ\nDescription: Core backend services and APIs',
          },
        ],
      };

      mockComponentService.createComponent.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockComponentService.createComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Backend API',
        'Core backend services and APIs'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle duplicate component error', async () => {
      const args = {
        project_identifier: 'PROJ',
        label: 'Frontend',
      };

      const error = new Error('Component "Frontend" already exists in project');
      mockComponentService.createComponent.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle project not found error', async () => {
      const args = {
        project_identifier: 'INVALID',
        label: 'Component',
      };

      const error = new Error('Project not found: INVALID');
      mockComponentService.createComponent.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
        label: 'Component',
      };

      const error = new Error('Failed to create component');
      mockComponentService.createComponent.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to create component:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        project_identifier: 'PROJ',
        label: 'Valid Component',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all fields', () => {
      const args = {
        project_identifier: 'PROJ',
        label: 'Component',
        description: 'This is a detailed component description',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without project identifier', () => {
      const args = {
        label: 'Component',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
        label: 'Component',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with invalid project identifier format', () => {
      const args = {
        project_identifier: 'proj-123',
        label: 'Component',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });

    it('should fail validation without label', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('label');
    });

    it('should fail validation with empty label', () => {
      const args = {
        project_identifier: 'PROJ',
        label: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('label');
      expect(errors.label).toContain('required');
    });

    it('should fail validation with too long project identifier', () => {
      const args = {
        project_identifier: 'TOOLONG',
        label: 'Component',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('5 characters');
    });
  });
});
