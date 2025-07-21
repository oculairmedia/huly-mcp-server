/**
 * Unit tests for deleteTemplate tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../deleteTemplate.js';

describe('deleteTemplate tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      deleteTemplate: jest.fn(),
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
      expect(definition.name).toBe('huly_delete_template');
      expect(definition.description).toContain('Delete an existing template');
      expect(definition.inputSchema.required).toEqual(['template_id']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should delete template successfully', async () => {
      const args = {
        template_id: 'template-123',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Successfully deleted template "Bug Fix Template" (template-123)',
          },
        ],
      };

      mockTemplateService.deleteTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.deleteTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle template with children deletion', async () => {
      const args = {
        template_id: 'parent-template',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Successfully deleted template "Parent Template" (parent-template)\n\nAlso deleted 3 child templates.',
          },
        ],
      };

      mockTemplateService.deleteTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.deleteTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'parent-template'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle template not found error', async () => {
      const args = {
        template_id: 'invalid-template',
      };

      const error = new Error('Template not found: invalid-template');
      mockTemplateService.deleteTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle template in use error', async () => {
      const args = {
        template_id: 'template-123',
      };

      const error = new Error('Template is currently in use and cannot be deleted');
      mockTemplateService.deleteTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        template_id: 'template-123',
      };

      const error = new Error('Failed to delete template');
      mockTemplateService.deleteTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to delete template:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with valid template_id', () => {
      const args = {
        template_id: 'template-123',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with different id formats', () => {
      const validIds = [
        'template-123',
        'abc123',
        'TEMPLATE_456',
        '123456789',
        'complex-id-with-numbers-123',
      ];

      validIds.forEach((id) => {
        const args = { template_id: id };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without template_id', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
      expect(errors.template_id).toContain('required');
    });

    it('should fail validation with empty template_id', () => {
      const args = {
        template_id: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation with null template_id', () => {
      const args = {
        template_id: null,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation with number template_id', () => {
      const args = {
        template_id: 123,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
      expect(errors.template_id).toContain('string');
    });

    it('should fail validation with boolean template_id', () => {
      const args = {
        template_id: true,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
      expect(errors.template_id).toContain('string');
    });
  });
});
