/**
 * CreateProject Tool Tests
 *
 * Tests for the project creation tool
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Import the tool
import { definition, handler, validate } from '../../../../src/tools/projects/createProject.js';

describe('CreateProject Tool Tests', () => {
  let mockContext;
  let mockClient;
  let mockLogger;
  let mockProjectService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockClient = {};

    mockProjectService = {
      createProject: jest.fn(),
    };

    mockContext = {
      client: mockClient,
      services: {
        projectService: mockProjectService,
      },
      logger: mockLogger,
    };
  });

  describe('Definition', () => {
    test('should have correct tool definition', () => {
      expect(definition.name).toBe('huly_create_project');
      expect(definition.description).toContain('Create a new project');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.required).toEqual(['name']);
    });
  });

  describe('Handler', () => {
    test('should create project with minimal required fields', async () => {
      const args = {
        name: 'Test Project',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'Project created successfully',
          },
        ],
      };

      mockProjectService.createProject.mockResolvedValueOnce(mockResult);

      const result = await handler(args, mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating new project', args);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        mockClient,
        'Test Project',
        undefined,
        undefined
      );
      expect(result).toBe(mockResult);
    });

    test('should create project with all fields', async () => {
      const args = {
        name: 'Test Project',
        description: 'This is a test project for unit testing',
        identifier: 'TEST',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'Project TEST created successfully',
          },
        ],
      };

      mockProjectService.createProject.mockResolvedValueOnce(mockResult);

      const result = await handler(args, mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating new project', args);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        mockClient,
        'Test Project',
        'This is a test project for unit testing',
        'TEST'
      );
      expect(result).toBe(mockResult);
    });

    test('should handle empty description', async () => {
      const args = {
        name: 'Test Project',
        description: '',
        identifier: 'TEST',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'Project created',
          },
        ],
      };

      mockProjectService.createProject.mockResolvedValueOnce(mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        mockClient,
        'Test Project',
        '',
        'TEST'
      );
      expect(result).toBe(mockResult);
    });

    test('should handle service errors', async () => {
      const args = {
        name: 'Test Project',
      };

      const error = new Error('Failed to create project: Name already exists');
      mockProjectService.createProject.mockRejectedValueOnce(error);

      const result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create project:', error);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Failed to create project: Name already exists');
    });

    test('should handle network errors', async () => {
      const args = {
        name: 'Test Project',
        identifier: 'TEST',
      };

      const error = new Error('Network timeout');
      mockProjectService.createProject.mockRejectedValueOnce(error);

      const result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create project:', error);
      expect(result.content[0].text).toContain('Network timeout');
    });

    test('should handle validation errors from service', async () => {
      const args = {
        name: 'Test',
        identifier: 'TOOLONG',
      };

      const error = new Error('Identifier must be 5 characters or less');
      mockProjectService.createProject.mockRejectedValueOnce(error);

      const result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create project:', error);
      expect(result.content[0].text).toContain('Identifier must be 5 characters or less');
    });
  });

  describe('Validate Function', () => {
    test('should validate required name field', () => {
      const errors = validate({});
      expect(errors).toHaveProperty('name');
      expect(errors.name).toContain('required');
    });

    test('should validate empty name', () => {
      const errors = validate({
        name: '  ',
      });
      expect(errors).toHaveProperty('name');
      expect(errors.name).toContain('required');
    });

    test('should pass validation with valid name only', () => {
      const errors = validate({
        name: 'Test Project',
      });
      expect(errors).toBeNull();
    });

    test('should validate identifier length', () => {
      const errors = validate({
        name: 'Test',
        identifier: 'TOOLONG',
      });
      expect(errors).toHaveProperty('identifier');
      expect(errors.identifier).toContain('5 characters or less');
    });

    test('should validate identifier uppercase', () => {
      const errors = validate({
        name: 'Test',
        identifier: 'test',
      });
      expect(errors).toHaveProperty('identifier');
      // Lowercase letters fail the regex test which checks for uppercase letters
      expect(errors.identifier).toContain('uppercase letters and numbers');
    });

    test('should validate identifier characters', () => {
      const errors = validate({
        name: 'Test',
        identifier: 'TE-ST',
      });
      expect(errors).toHaveProperty('identifier');
      expect(errors.identifier).toContain('uppercase letters and numbers');
    });

    test('should accept valid identifier with letters', () => {
      const errors = validate({
        name: 'Test',
        identifier: 'TEST',
      });
      expect(errors).toBeNull();
    });

    test('should accept valid identifier with numbers', () => {
      const errors = validate({
        name: 'Test',
        identifier: 'T3ST',
      });
      expect(errors).toBeNull();
    });

    test('should accept single character identifier', () => {
      const errors = validate({
        name: 'Test',
        identifier: 'A',
      });
      expect(errors).toBeNull();
    });

    test('should accept 5 character identifier', () => {
      const errors = validate({
        name: 'Test',
        identifier: 'ABCDE',
      });
      expect(errors).toBeNull();
    });

    test('should ignore extra fields', () => {
      const errors = validate({
        name: 'Test',
        extraField: 'value',
      });
      expect(errors).toBeNull();
    });

    test('should validate all fields together', () => {
      const errors = validate({
        name: 'Test Project',
        description: 'This is a test project',
        identifier: 'TEST',
      });
      expect(errors).toBeNull();
    });
  });
});
