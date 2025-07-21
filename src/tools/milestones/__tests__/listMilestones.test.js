/**
 * Unit tests for listMilestones tool
 */

import { jest } from '@jest/globals';
import { definition, handler, validate } from '../listMilestones.js';

describe('listMilestones tool', () => {
  let mockContext;
  let mockMilestoneService;

  beforeEach(() => {
    mockMilestoneService = {
      listMilestones: jest.fn(),
    };

    mockContext = {
      client: {},
      services: {
        milestoneService: mockMilestoneService,
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
      expect(definition.name).toBe('huly_list_milestones');
      expect(definition.description).toContain('List all milestones');
      expect(definition.inputSchema.required).toEqual(['project_identifier']);
      expect(definition.annotations.readOnlyHint).toBe(true);
    });
  });

  describe('handler', () => {
    it('should list milestones successfully', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: `## Milestones in PROJ

### v1.0 - Initial Release
Status: In Progress
Target Date: 2024-03-01
Description: First public release with core features
Progress: 65% (13 of 20 issues completed)

### v1.1 - Performance Update
Status: Planned
Target Date: 2024-04-15
Description: Performance improvements and bug fixes
Progress: 0% (0 of 8 issues completed)

### v2.0 - Major Update
Status: Planned
Target Date: 2024-06-01
Description: New features and UI overhaul
Progress: 0% (0 of 15 issues completed)

Total milestones: 3`,
          },
        ],
      };

      mockMilestoneService.listMilestones.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockMilestoneService.listMilestones).toHaveBeenCalledWith(mockContext.client, 'PROJ');
      expect(result).toEqual(mockResult);
    });

    it('should handle empty milestones list', async () => {
      const args = {
        project_identifier: 'NEWPROJ',
      };

      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'No milestones found in project NEWPROJ',
          },
        ],
      };

      mockMilestoneService.listMilestones.mockResolvedValue(mockResult);

      const result = await handler(args, mockContext);

      expect(mockMilestoneService.listMilestones).toHaveBeenCalledWith(
        mockContext.client,
        'NEWPROJ'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle project not found error', async () => {
      const args = {
        project_identifier: 'INVALID',
      };

      const error = new Error('Project not found: INVALID');
      mockMilestoneService.listMilestones.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const error = new Error('Failed to list milestones');
      mockMilestoneService.listMilestones.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to list milestones:', error);
    });
  });

  describe('validate', () => {
    it('should pass validation with valid project identifier', () => {
      const args = {
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should pass validation with different valid project formats', () => {
      const validIdentifiers = ['A', 'AB', 'ABC', 'ABCD', 'ABCDE'];

      validIdentifiers.forEach((identifier) => {
        const args = { project_identifier: identifier };
        const errors = validate(args);
        expect(errors).toBeNull();
      });
    });

    it('should fail validation without project identifier', () => {
      const args = {};

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('required');
    });

    it('should fail validation with empty project identifier', () => {
      const args = {
        project_identifier: '   ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
    });

    it('should fail validation with lowercase project identifier', () => {
      const args = {
        project_identifier: 'proj',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });

    it('should fail validation with mixed case project identifier', () => {
      const args = {
        project_identifier: 'Proj',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });

    it('should fail validation with too long project identifier', () => {
      const args = {
        project_identifier: 'TOOLONG',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('5 characters');
    });

    it('should fail validation with special characters', () => {
      const args = {
        project_identifier: 'PR_OJ',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });

    it('should fail validation with numbers in project identifier', () => {
      const args = {
        project_identifier: 'PRO1',
      };

      const errors = validate(args);
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('uppercase');
    });
  });
});
