/**
 * Unit tests for createIssueFromTemplate tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../createIssueFromTemplate.js';

describe('createIssueFromTemplate tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      createIssueFromTemplate: jest.fn(),
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
      expect(definition.name).toBe('huly_create_issue_from_template');
      expect(definition.description).toContain('Create issues from a template');
      expect(definition.inputSchema.required).toEqual(['template_id']);
      expect(definition.annotations.destructiveHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should create issue from template with defaults', async () => {
      const args = {
        template_id: 'template-123',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Issue created successfully: Bug Report (PROJ-456)\nCreated 2 sub-issues from child templates',
          },
        ],
      };

      mockTemplateService.createIssueFromTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.createIssueFromTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        {
          title: undefined,
          priority: undefined,
          assignee: undefined,
          component: undefined,
          milestone: undefined,
          estimation: undefined,
          includeChildren: true,
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should create issue with custom values', async () => {
      const args = {
        template_id: 'template-123',
        title: 'Critical Bug: Login fails',
        priority: 'urgent',
        assignee: 'developer@example.com',
        component: 'Auth',
        milestone: 'v1.1',
        estimation: 4,
        include_children: false,
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Issue created successfully: Critical Bug: Login fails (PROJ-789)',
          },
        ],
      };

      mockTemplateService.createIssueFromTemplate.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.createIssueFromTemplate).toHaveBeenCalledWith(
        mockContext.client,
        'template-123',
        {
          title: 'Critical Bug: Login fails',
          priority: 'urgent',
          assignee: 'developer@example.com',
          component: 'Auth',
          milestone: 'v1.1',
          estimation: 4,
          includeChildren: false,
        }
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle template not found error', async () => {
      const args = {
        template_id: 'invalid-template',
      };

      const error = new Error('Template not found: invalid-template');
      mockTemplateService.createIssueFromTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        template_id: 'template-123',
      };

      const error = new Error('Failed to create issue from template');
      mockTemplateService.createIssueFromTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to create issue from template:',
        error
      );
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        template_id: 'template-123',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all fields', () => {
      const args = {
        template_id: 'template-123',
        title: 'Custom Title',
        priority: 'high',
        assignee: 'user@example.com',
        component: 'Frontend',
        milestone: 'v2.0',
        estimation: 8,
        include_children: false,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without template_id', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation with empty template_id', () => {
      const args = {
        template_id: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
    });

    it('should fail validation with invalid priority', () => {
      const args = {
        template_id: 'template-123',
        priority: 'invalid',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('priority');
    });

    it('should fail validation with negative estimation', () => {
      const args = {
        template_id: 'template-123',
        estimation: -1,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('estimation');
    });

    it('should fail validation with invalid assignee email', () => {
      const args = {
        template_id: 'template-123',
        assignee: 'not-an-email',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('assignee');
    });

    it('should fail validation with non-boolean include_children', () => {
      const args = {
        template_id: 'template-123',
        include_children: 'yes',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('include_children');
    });

    it('should pass validation with empty optional strings', () => {
      const args = {
        template_id: 'template-123',
        title: '',
        component: '',
        milestone: '',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });
  });
});
