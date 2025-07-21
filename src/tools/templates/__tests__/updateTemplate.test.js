/**
 * Unit tests for updateTemplate tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../updateTemplate.js';

describe('updateTemplate tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      updateTemplate: jest.fn(),
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
      expect(definition.name).toBe('huly_update_template');
      expect(definition.description).toContain('Update an existing template');
      expect(definition.inputSchema.required).toEqual(['template_id', 'field', 'value']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should update template title successfully', async () => {
      const args = {
        template_id: 'template-123',
        field: 'title',
        value: 'Updated Bug Fix Template',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Updated template title to "Updated Bug Fix Template"',
          },
        ],
      };

      mockTemplateService.updateTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.updateTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        'title',
        'Updated Bug Fix Template'
      );
      expect(result).toEqual(mockResult);
    });

    it('should update template description', async () => {
      const args = {
        template_id: 'template-123',
        field: 'description',
        value: 'Updated description with more details',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Updated template description',
          },
        ],
      };

      mockTemplateService.updateTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.updateTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        'description',
        'Updated description with more details'
      );
      expect(result).toEqual(mockResult);
    });

    it('should update template priority', async () => {
      const args = {
        template_id: 'template-123',
        field: 'priority',
        value: 'urgent',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Updated template priority to urgent',
          },
        ],
      };

      mockTemplateService.updateTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.updateTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        'priority',
        'urgent'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle template not found', async () => {
      const args = {
        template_id: 'invalid-template',
        field: 'title',
        value: 'New Title',
      };

      const error = new Error('Template not found: invalid-template');
      mockTemplateService.updateTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        template_id: 'template-123',
        field: 'title',
        value: 'New Title',
      };

      const error = new Error('Failed to update template');
      mockTemplateService.updateTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to update template:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with valid args', () => {
      const args = {
        template_id: 'template-123',
        field: 'title',
        value: 'New Title',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation for all valid fields', () => {
      const validFields = [
        'title',
        'description',
        'priority',
        'estimation',
        'assignee',
        'component',
        'milestone',
      ];

      validFields.forEach((field) => {
        const args = {
          template_id: 'template-123',
          field,
          value: 'test value',
        };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without template_id', () => {
      const args = {
        field: 'title',
        value: 'New Title',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation with empty template_id', () => {
      const args = {
        template_id: '   ',
        field: 'title',
        value: 'New Title',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation without field', () => {
      const args = {
        template_id: 'template-123',
        value: 'New Value',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('field');
    });

    it('should fail validation with invalid field', () => {
      const args = {
        template_id: 'template-123',
        field: 'invalid_field',
        value: 'New Value',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('field');
    });

    it('should fail validation without value', () => {
      const args = {
        template_id: 'template-123',
        field: 'title',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('value');
    });

    it('should fail validation with empty value', () => {
      const args = {
        template_id: 'template-123',
        field: 'title',
        value: '',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('value');
    });
  });
});
