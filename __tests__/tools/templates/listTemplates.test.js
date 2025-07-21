import { jest } from '@jest/globals';
import { handler as listTemplatesHandler } from '../../../src/tools/templates/listTemplates.js';

describe('listTemplates tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      listTemplates: jest.fn(),
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

  it('should list templates successfully', async () => {
    const args = {
      project_identifier: 'PROJ',
    };

    const mockTemplates = [
      {
        _id: 'template-1',
        title: 'Bug Report Template',
        description: 'For reporting bugs',
        priority: 'high',
        childCount: 0,
      },
      {
        _id: 'template-2',
        title: 'Feature Template',
        description: 'For new features',
        priority: 'medium',
        childCount: 3,
      },
    ];

    mockTemplateService.listTemplates.mockResolvedValue(mockTemplates);

    const result = await listTemplatesHandler(args, mockContext);

    expect(mockTemplateService.listTemplates).toHaveBeenCalledWith(mockContext.client, 'PROJ', 50);
    expect(result).toContain('Found 2 templates');
    expect(result).toContain('Bug Report Template');
    expect(result).toContain('Feature Template');
    expect(result).toContain('(3 children)');
  });

  it('should handle empty template list', async () => {
    const args = {
      project_identifier: 'PROJ',
    };

    mockTemplateService.listTemplates.mockResolvedValue([]);

    const result = await listTemplatesHandler(args, mockContext);

    expect(result).toBe('No templates found in project PROJ');
  });

  it('should apply custom limit', async () => {
    const args = {
      project_identifier: 'PROJ',
      limit: 10,
    };

    mockTemplateService.listTemplates.mockResolvedValue([]);

    await listTemplatesHandler(args, mockContext);

    expect(mockTemplateService.listTemplates).toHaveBeenCalledWith(mockContext.client, 'PROJ', 10);
  });

  it('should validate project identifier', async () => {
    const args = {
      project_identifier: '',
    };

    await expect(listTemplatesHandler(args, mockContext)).rejects.toThrow(
      'Project identifier is required'
    );
  });

  it('should handle service errors', async () => {
    const args = {
      project_identifier: 'PROJ',
    };

    mockTemplateService.listTemplates.mockRejectedValue(new Error('Project not found'));

    await expect(listTemplatesHandler(args, mockContext)).rejects.toThrow('Project not found');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });

  it('should format templates with all fields', async () => {
    const args = {
      project_identifier: 'PROJ',
    };

    const mockTemplates = [
      {
        _id: 'template-1',
        title: 'Complete Template',
        description: 'A template with all fields',
        priority: 'urgent',
        estimation: 8,
        assignee: 'user@example.com',
        component: 'Backend',
        milestone: 'v1.0',
        childCount: 2,
      },
    ];

    mockTemplateService.listTemplates.mockResolvedValue(mockTemplates);

    const result = await listTemplatesHandler(args, mockContext);

    expect(result).toContain('Complete Template');
    expect(result).toContain('A template with all fields');
    expect(result).toContain('Priority: urgent');
    expect(result).toContain('Estimation: 8h');
    expect(result).toContain('Assignee: user@example.com');
    expect(result).toContain('Component: Backend');
    expect(result).toContain('Milestone: v1.0');
    expect(result).toContain('(2 children)');
  });
});
