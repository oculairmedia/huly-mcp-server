import { jest } from '@jest/globals';
import { handler as createTemplateHandler } from '../../../src/tools/templates/createTemplate.js';

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

  it('should create a simple template', async () => {
    const args = {
      project_identifier: 'PROJ',
      title: 'Bug Report Template',
      description: 'Standard bug report template',
      priority: 'high',
    };

    const mockResult = {
      success: true,
      templateId: 'template-123',
      title: 'Bug Report Template',
      childrenCreated: 0,
    };

    mockTemplateService.createTemplate.mockResolvedValue(mockResult);

    const result = await createTemplateHandler(args, mockContext);

    expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
      mockContext.client,
      'PROJ',
      {
        title: 'Bug Report Template',
        description: 'Standard bug report template',
        priority: 'high',
        estimation: 0,
        assignee: undefined,
        component: undefined,
        milestone: undefined,
        children: undefined,
      }
    );
    expect(result).toContain('✅ Template created successfully');
    expect(result).toContain('Bug Report Template');
  });

  it('should create template with children', async () => {
    const args = {
      project_identifier: 'PROJ',
      title: 'Feature Template',
      children: [
        {
          title: 'Design',
          description: 'Design the feature',
          priority: 'high',
        },
        {
          title: 'Implementation',
          description: 'Implement the feature',
          priority: 'medium',
        },
      ],
    };

    const mockResult = {
      success: true,
      templateId: 'template-123',
      title: 'Feature Template',
      childrenCreated: 2,
    };

    mockTemplateService.createTemplate.mockResolvedValue(mockResult);

    const result = await createTemplateHandler(args, mockContext);

    expect(result).toContain('✅ Template created successfully');
    expect(result).toContain('Created 2 child templates');
  });

  it('should handle creation failure', async () => {
    const args = {
      project_identifier: 'PROJ',
      title: 'Test Template',
    };

    mockTemplateService.createTemplate.mockRejectedValue(new Error('Project not found'));

    await expect(createTemplateHandler(args, mockContext)).rejects.toThrow('Project not found');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });

  it('should validate project identifier', async () => {
    const args = {
      project_identifier: '',
      title: 'Test Template',
    };

    await expect(createTemplateHandler(args, mockContext)).rejects.toThrow(
      'Project identifier is required'
    );
  });

  it('should validate title', async () => {
    const args = {
      project_identifier: 'PROJ',
      title: '',
    };

    await expect(createTemplateHandler(args, mockContext)).rejects.toThrow(
      'Template title is required'
    );
  });

  it('should handle all optional fields', async () => {
    const args = {
      project_identifier: 'PROJ',
      title: 'Complete Template',
      description: 'A complete template',
      priority: 'urgent',
      estimation: 8,
      assignee: 'user@example.com',
      component: 'Backend',
      milestone: 'v1.0',
    };

    const mockResult = {
      success: true,
      templateId: 'template-123',
      title: 'Complete Template',
      childrenCreated: 0,
    };

    mockTemplateService.createTemplate.mockResolvedValue(mockResult);

    const result = await createTemplateHandler(args, mockContext);

    expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
      mockContext.client,
      'PROJ',
      {
        title: 'Complete Template',
        description: 'A complete template',
        priority: 'urgent',
        estimation: 8,
        assignee: 'user@example.com',
        component: 'Backend',
        milestone: 'v1.0',
        children: undefined,
      }
    );
    expect(result).toContain('✅ Template created successfully');
  });
});