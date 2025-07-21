/**
 * Unit tests for removeChildTemplate tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../removeChildTemplate.js';

describe('removeChildTemplate tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      removeChildTemplate: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        templateService: mockTemplateService,
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
      expect(definition.name).toBe('huly_remove_child_template');
      expect(definition.description).toContain('Remove a child template');
      expect(definition.inputSchema.required).toEqual(['template_id', 'child_index']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should remove child template successfully', async () => {
      const args = {
        template_id: 'parent-template',
        child_index: 1,
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Removed child template at index 1 from parent template',
          },
        ],
      };

      mockTemplateService.removeChildTemplate.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.removeChildTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'parent-template',
        1
      );
      expect(result).toEqual(_mockResult);
    });

    it('should handle template not found', async () => {
      const args = {
        template_id: 'invalid-template',
        child_index: 0,
      };

      const error = new Error('Template not found: invalid-template');
      mockTemplateService.removeChildTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle invalid child index', async () => {
      const args = {
        template_id: 'parent-template',
        child_index: 10,
      };

      const error = new Error('Child template at index 10 not found');
      mockTemplateService.removeChildTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        template_id: 'parent-template',
        child_index: 0,
      };

      const error = new Error('Failed to remove child template');
      mockTemplateService.removeChildTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to remove child template:',
        error
      );
    });
  });

  describe('validate', () => {
    it('should pass validation with valid args', () => {
      const args = {
        template_id: 'template-123',
        child_index: 0,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with different valid indices', () => {
      const validIndices = [0, 1, 5, 10, 100];

      validIndices.forEach((index) => {
        const args = {
          template_id: 'template-123',
          child_index: index,
        };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without template_id', () => {
      const args = {
        child_index: 0,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation with empty template_id', () => {
      const args = {
        template_id: '   ',
        child_index: 0,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation without child_index', () => {
      const args = {
        template_id: 'template-123',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('child_index');
    });

    it('should fail validation with negative child_index', () => {
      const args = {
        template_id: 'template-123',
        child_index: -1,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('child_index');
      expect(errors.child_index).toContain('non-negative');
    });

    it('should fail validation with non-numeric child_index', () => {
      const args = {
        template_id: 'template-123',
        child_index: 'first',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('child_index');
      expect(errors.child_index).toContain('integer');
    });

    it('should fail validation with decimal child_index', () => {
      const args = {
        template_id: 'template-123',
        child_index: 1.5,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('child_index');
      expect(errors.child_index).toContain('integer');
    });
  });
});
