/**
 * Unit tests for assignRepository tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../assignRepository.js';

describe('assignRepository tool', () => {
  let mockContext;
  let mockGitHubService;

  beforeEach(() => {
    mockGitHubService = {
      assignRepository: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        gitHubService: mockGitHubService,
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
      expect(definition.name).toBe('huly_assign_repository_to_project');
      expect(definition.description).toContain('Assign a GitHub repository');
      expect(definition.inputSchema.required).toEqual(['project_identifier', 'repository_name']);
      expect(definition.annotations.destructiveHint).toBe(false);
    });
  });

  describe('handler', () => {
    it('should assign repository successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
        repository_name: 'my-org/my-repo',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '✅ Assigned repository "my-org/my-repo" to project PROJ\n\nWebhook configured and repository synced.',
          },
        ],
      };

      mockGitHubService.assignRepository.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockGitHubService.assignRepository).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'my-org/my-repo'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle repository already assigned', async () => {
      const args = {
        project_identifier: 'PROJ',
        repository_name: 'my-org/existing-repo',
      };

      const error = new Error(
        'Repository "my-org/existing-repo" is already assigned to project PROJ'
      );
      mockGitHubService.assignRepository.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle project not found error', async () => {
      const args = {
        project_identifier: 'INVALID',
        repository_name: 'my-org/my-repo',
      };

      const error = new Error('Project not found: INVALID');
      mockGitHubService.assignRepository.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle repository not found error', async () => {
      const args = {
        project_identifier: 'PROJ',
        repository_name: 'nonexistent/repo',
      };

      const error = new Error('Repository not found in GitHub integration: nonexistent/repo');
      mockGitHubService.assignRepository.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
        repository_name: 'my-org/my-repo',
      };

      const error = new Error('Failed to assign repository');
      mockGitHubService.assignRepository.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to assign repository:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with valid args', () => {
      const args = {
        project_identifier: 'PROJ',
        repository_name: 'my-org/my-repo',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with different repo formats', () => {
      const validRepos = [
        'owner/repo',
        'my-org/my-repo',
        'user123/project-name',
        'company/app_name',
      ];

      validRepos.forEach((repo) => {
        const args = {
          project_identifier: 'PROJ',
          repository_name: repo,
        };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without project identifier', () => {
      const args = {
        repository_name: 'my-org/my-repo',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
        repository_name: 'my-org/my-repo',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with invalid project identifier format', () => {
      const args = {
        project_identifier: 'proj-123',
        repository_name: 'my-org/my-repo',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });

    it('should fail validation without repository name', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('repository_name');
    });

    it('should fail validation with empty repository name', () => {
      const args = {
        project_identifier: 'PROJ',
        repository_name: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('repository_name');
      expect(errors.repository_name).toContain('required');
    });

    it('should fail validation with invalid repository format', () => {
      const invalidRepos = [
        'no-slash',
        '/slash-start',
        'slash-end/',
        'owner//double-slash',
        'owner/repo/extra',
        'https://github.com/owner/repo',
      ];

      invalidRepos.forEach((repo) => {
        const args = {
          project_identifier: 'PROJ',
          repository_name: repo,
        };
        const errors = validate(args);
        expect(errors).toHaveProperty('repository_name');
        expect(errors.repository_name).toContain('format');
      });
    });
  });
});
