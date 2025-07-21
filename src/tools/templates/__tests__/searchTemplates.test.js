/**
 * Unit tests for searchTemplates tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../searchTemplates.js';

describe('searchTemplates tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      searchTemplates: jest.fn(),
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
      expect(definition.name).toBe('huly_search_templates');
      expect(definition.description).toContain('Search for templates');
      expect(definition.inputSchema.required).toEqual(['query']);
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should search templates successfully', async () => {
      const args = {
        query: 'bug fix',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: `Found 3 templates matching "bug fix"

### Bug Fix Template (PROJ)
Standard template for bug fixes
Priority: High, Estimation: 4h

### Critical Bug Fix (PROJ)
Template for critical production bugs
Priority: Urgent, Estimation: 2h

### Minor Bug Fix (TEST)
Template for low-priority bugs
Priority: Low, Estimation: 1h`,
          },
        ],
      };

      mockTemplateService.searchTemplates.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.searchTemplates).toHaveBeenCalledWith(
        mockContext.client,
        args.query,
        args.project_identifier,
        args.limit
      );
      expect(result).toEqual(_mockResult);
    });

    it('should search with project filter', async () => {
      const args = {
        query: 'feature',
        project_identifier: 'PROJ',
        limit: 10,
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: 'Found 2 templates in project PROJ',
          },
        ],
      };

      mockTemplateService.searchTemplates.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.searchTemplates).toHaveBeenCalledWith(
        mockContext.client,
        args.query,
        args.project_identifier,
        args.limit
      );
      expect(result).toEqual(_mockResult);
    });

    it('should handle empty search results', async () => {
      const args = {
        query: 'nonexistent',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: 'No templates found matching "nonexistent"',
          },
        ],
      };

      mockTemplateService.searchTemplates.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(result).toEqual(_mockResult);
    });

    it('should handle service errors', async () => {
      const args = {
        query: 'test',
      };

      const error = new Error('Search service unavailable');
      mockTemplateService.searchTemplates.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to search templates:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with query only', () => {
      const args = {
        query: 'bug',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with all parameters', () => {
      const args = {
        query: 'feature',
        project_identifier: 'PROJ',
        limit: 25,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation without query', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('query');
      expect(errors.query).toContain('required');
    });

    it('should fail validation with empty query', () => {
      const args = {
        query: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('query');
    });

    it('should pass validation with any project identifier format', () => {
      const args = {
        query: 'test',
        project_identifier: 'proj-123',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should fail validation with invalid limit', () => {
      const args = {
        query: 'test',
        limit: -5,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });

    it('should fail validation with non-numeric limit', () => {
      const args = {
        query: 'test',
        limit: 'ten',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('limit');
    });
  });
});
