/**
 * Unit tests for addChildTemplate tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../addChildTemplate.js';

describe('addChildTemplate tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      addChildTemplate: jest.fn(),
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
      expect(definition.name).toBe('huly_add_child_template');
      expect(definition.description).toContain('Add a child template');
      expect(definition.inputSchema.required).toEqual(['template_id', 'title']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should add child template successfully with minimal args', async () => {
      const args = {
        template_id: 'template-123',
        title: 'Child Task',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Added child template "Child Task" to parent template',
          },
        ],
      };

      mockTemplateService.addChildTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.addChildTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        {
          title: 'Child Task',
          description: undefined,
          priority: 'medium',
          estimation: 0,
          assignee: undefined,
          component: undefined,
          milestone: undefined,
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should add child template with all fields', async () => {
      const args = {
        template_id: 'template-123',
        title: 'Complete Child Task',
        description: 'A child task with all fields',
        priority: 'high',
        estimation: 5,
        assignee: 'user@example.com',
        component: 'Frontend',
        milestone: 'v1.0',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Added child template "Complete Child Task" to parent template',
          },
        ],
      };

      mockTemplateService.addChildTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.addChildTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        {
          title: 'Complete Child Task',
          description: 'A child task with all fields',
          priority: 'high',
          estimation: 5,
          assignee: 'user@example.com',
          component: 'Frontend',
          milestone: 'v1.0',
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle template not found error', async () => {
      const args = {
        template_id: 'invalid-template',
        title: 'Child Task',
      };

      const error = new Error('Template not found: invalid-template');
      mockTemplateService.addChildTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        template_id: 'template-123',
        title: 'Child Task',
      };

      const error = new Error('Failed to add child template');
      mockTemplateService.addChildTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to add child template:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        template_id: 'template-123',
        title: 'Valid Child',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all fields', () => {
      const args = {
        template_id: 'template-123',
        title: 'Complete Child',
        description: 'Description',
        priority: 'urgent',
        estimation: 10,
        assignee: 'user@example.com',
        component: 'Backend',
        milestone: 'v2.0',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without template_id', () => {
      const args = {
        title: 'Child Task',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation with empty template_id', () => {
      const args = {
        template_id: '   ',
        title: 'Child Task',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation without title', () => {
      const args = {
        template_id: 'template-123',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('title');
    });

    it('should fail validation with empty title', () => {
      const args = {
        template_id: 'template-123',
        title: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('title');
    });

    it('should fail validation with invalid priority', () => {
      const args = {
        template_id: 'template-123',
        title: 'Child Task',
        priority: 'invalid',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('priority');
    });

    it('should fail validation with negative estimation', () => {
      const args = {
        template_id: 'template-123',
        title: 'Child Task',
        estimation: -5,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('estimation');
    });

    it('should fail validation with non-numeric estimation', () => {
      const args = {
        template_id: 'template-123',
        title: 'Child Task',
        estimation: 'five',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('estimation');
    });

    it('should fail validation with invalid email', () => {
      const args = {
        template_id: 'template-123',
        title: 'Child Task',
        assignee: 'not-an-email',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('assignee');
    });
  });
});
