/**
 * Unit tests for getTemplateDetails tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../getTemplateDetails.js';

describe('getTemplateDetails tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      getTemplateDetails: jest.fn(),
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
      expect(definition.name).toBe('huly_get_template_details');
      expect(definition.description).toContain('comprehensive details');
      expect(definition.inputSchema.required).toEqual(['template_id']);
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should get template details successfully', async () => {
      const args = {
        template_id: 'template-123',
      };

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: `# Template: Bug Fix Template

**Project**: PROJ
**Priority**: High
**Estimation**: 4h
**Component**: Backend
**Milestone**: v1.0
**Assignee**: developer@example.com

## Description

Standard template for bug fixes requiring investigation and testing.

## Child Templates (3)

### 1. Investigate Issue
Priority: High, Estimation: 1h

### 2. Implement Fix
Priority: High, Estimation: 2h

### 3. Add Tests
Priority: Medium, Estimation: 1h`,
          },
        ],
      };

      mockTemplateService.getTemplateDetails.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockTemplateService.getTemplateDetails).toHaveBeenCalledWith(
        mockContext.client,
        'template-123'
      );
      expect(result).toEqual(_mockResult);
    });

    it('should handle template not found', async () => {
      const args = {
        template_id: 'invalid-template',
      };

      const error = new Error('Template not found: invalid-template');
      mockTemplateService.getTemplateDetails.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        template_id: 'template-123',
      };

      const error = new Error('Failed to fetch template details');
      mockTemplateService.getTemplateDetails.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to get template details:',
        error
      );
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

    it('should fail validation with non-string template_id', () => {
      const args = {
        template_id: 123,
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('template_id');
      expect(errors.template_id).toContain('string');
    });
  });
});
