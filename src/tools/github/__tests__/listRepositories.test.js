/**
 * Unit tests for listRepositories tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../listRepositories.js';

describe('listRepositories tool', () => {
  let mockContext;
  let mockProjectService;

  beforeEach(() => {
    mockProjectService = {
      listGithubRepositories: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        projectService: mockProjectService,
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
      expect(definition.name).toBe('huly_list_github_repositories');
      expect(definition.description).toContain('List all GitHub repositories');
      expect(definition.inputSchema.properties).toEqual({});
      expect(definition.inputSchema.required).toEqual([]);
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should list repositories successfully', async () => {
      const args = {};

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: `## GitHub Repositories Available for Integration

### my-org/frontend-app
Description: Main frontend application
Language: TypeScript
Stars: 120
Last updated: 2024-01-20

### my-org/backend-api
Description: Core API services
Language: JavaScript
Stars: 85
Last updated: 2024-01-19

### my-org/mobile-app
Description: React Native mobile application
Language: JavaScript
Stars: 45
Last updated: 2024-01-18

Total repositories: 3`,
          },
        ],
      };

      mockProjectService.listGithubRepositories.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.listGithubRepositories).toHaveBeenCalledWith(mockContext.client);
      expect(result).toEqual(_mockResult);
    });

    it('should handle empty repositories list', async () => {
      const args = {};

      const _mockResult = {
        content: [
          {
            type: 'text',
            text: 'No GitHub repositories found. Please check your GitHub integration settings.',
          },
        ],
      };

      mockProjectService.listGithubRepositories.mockResolvedValue(_mockResult);

      const result = await handler(args, mockContext);

      expect(mockProjectService.listGithubRepositories).toHaveBeenCalledWith(mockContext.client);
      expect(result).toEqual(_mockResult);
    });

    it('should handle GitHub integration not configured', async () => {
      const args = {};

      const error = new Error('GitHub integration not configured');
      mockProjectService.listGithubRepositories.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      const args = {};

      const error = new Error('GitHub authentication failed: Invalid token');
      mockProjectService.listGithubRepositories.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {};

      const error = new Error('Failed to list repositories');
      mockProjectService.listGithubRepositories.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Failed to list GitHub repositories:',
        error
      );
    });

    it('should handle rate limit errors', async () => {
      const args = {};

      const error = new Error('GitHub API rate limit exceeded');
      mockProjectService.listGithubRepositories.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should pass validation with empty args', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with any extra properties', () => {
      const args = {
        extra: 'property',
        another: 123,
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });
  });
});
