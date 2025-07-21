/**
 * Unit tests for createTemplate tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../createTemplate.js';

describe('createTemplate tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      createTemplate: jest.fn(),
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
      expect(definition.name).toBe('huly_create_template');
      expect(definition.description).toContain('Create a new issue template');
      expect(definition.inputSchema.required).toEqual(['project_identifier', 'title']);
      expect(definition.annotations.destructiveHint).toBe(false);
    });
  });

  describe('handler', () => {
    it('should create template successfully with minimal args', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Bug Report Template',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Template created successfully\nID: template-123\nTitle: Bug Report Template',
          },
        ],
      };

      mockTemplateService.createTemplate.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(mockContext.client, 'PROJ', {
        title: 'Bug Report Template',
        description: '',
        priority: 'medium',
        estimation: 0,
        assignee: undefined,
        component: undefined,
        milestone: undefined,
        children: [],
      });
      expect(result).toEqual(_mockResult);
    });

    it('should create template with all fields', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Feature Template',
        description: 'Template for new features',
        priority: 'high',
        estimation: 8,
        assignee: 'developer@example.com',
        component: 'Frontend',
        milestone: 'v2.0',
        children: [
          {
            title: 'Design',
            description: 'Create design mockups',
            priority: 'high',
            estimation: 4,
          },
          {
            title: 'Implementation',
            description: 'Implement the feature',
            priority: 'medium',
            estimation: 16,
          },
        ],
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Template created successfully\nID: template-456\nTitle: Feature Template\nCreated 2 child templates',
          },
        ],
      };

      mockTemplateService.createTemplate.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(mockContext.client, 'PROJ', {
        title: 'Feature Template',
        description: 'Template for new features',
        priority: 'high',
        estimation: 8,
        assignee: 'developer@example.com',
        component: 'Frontend',
        milestone: 'v2.0',
        children: args.children,
      });
      expect(result).toEqual(_mockResult);
    });

    it('should handle project not found error', async () => {
      const args = {
        project_identifier: 'INVALID',
        title: 'Template',
      };

      const error = new Error('Project not found: INVALID');
      mockTemplateService.createTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Template',
      };

      const error = new Error('Failed to create template');
      mockTemplateService.createTemplate.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to create template:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with minimal valid args', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Valid Template',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all fields', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Complete Template',
        description: 'A complete template',
        priority: 'urgent',
        estimation: 12,
        assignee: 'user@example.com',
        component: 'Backend',
        milestone: 'v1.0',
        children: [{ title: 'Child 1', priority: 'high' }],
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without project identifier', () => {
      const args = {
        title: 'Template',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with invalid project identifier', () => {
      const args = {
        project_identifier: 'proj-123',
        title: 'Template',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation without title', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('title');
    });

    it('should fail validation with empty title', () => {
      const args = {
        project_identifier: 'PROJ',
        title: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('title');
    });

    it('should fail validation with invalid priority', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Template',
        priority: 'invalid',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('priority');
    });

    it('should fail validation with negative estimation', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Template',
        estimation: -5,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('estimation');
    });

    it('should fail validation with invalid assignee email', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Template',
        assignee: 'not-an-email',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('assignee');
    });

    it('should fail validation with invalid children', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Template',
        children: 'not an array',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('children');
    });

    it('should fail validation with invalid child template', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Template',
        children: [
          { title: 'Valid Child' },
          { description: 'Missing title' }, // Invalid - no title
        ],
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('children[1].title');
    });

    it('should fail validation with invalid child priority', () => {
      const args = {
        project_identifier: 'PROJ',
        title: 'Template',
        children: [{ title: 'Child', priority: 'invalid-priority' }],
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('children[0].priority');
    });
  });
});
