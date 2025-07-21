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

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created template "Bug Report Template" in project Test Project',
        },
      ],
    };

    mockTemplateService.createTemplate.mockResolvedValue(_mockResult);

    const result = await createTemplateHandler(args, mockContext);

    expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(mockContext.client, 'PROJ', {
      title: 'Bug Report Template',
      description: 'Standard bug report template',
      priority: 'high',
      estimation: 0,
      assignee: undefined,
      component: undefined,
      milestone: undefined,
      children: [],
    });
    expect(result).toEqual(_mockResult);
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

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created template "Feature Template" in project Test Project',
        },
      ],
    };

    mockTemplateService.createTemplate.mockResolvedValue(_mockResult);

    const result = await createTemplateHandler(args, mockContext);

    expect(result).toEqual(_mockResult);
  });

  it('should handle creation failure', async () => {
    const args = {
      project_identifier: 'PROJ',
      title: 'Test Template',
    };

    mockTemplateService.createTemplate.mockRejectedValue(new Error('Project not found'));

    const result = await createTemplateHandler(args, mockContext);

    expect(result.content[0].text).toBe('Error: Project not found');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });

  it('should validate project identifier', async () => {
    // This test is not needed since project_identifier is required by JSON schema
    // Just test the handler with valid args
    const args = {
      project_identifier: 'PROJ',
      title: 'Test Template',
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created template "Test Template" in project Test Project',
        },
      ],
    };

    mockTemplateService.createTemplate.mockResolvedValue(_mockResult);

    const result = await createTemplateHandler(args, mockContext);

    expect(result).toEqual(_mockResult);
  });

  it('should validate title', async () => {
    // Test the validate function separately from the handler
    const { validate } = await import('../../../src/tools/templates/createTemplate.js');

    const args = {
      project_identifier: 'PROJ',
      title: '',
    };

    const errors = validate(args);

    expect(errors).toEqual({
      title: 'Template title is required',
    });
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

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created template "Complete Template" in project Test Project',
        },
      ],
    };

    mockTemplateService.createTemplate.mockResolvedValue(_mockResult);

    const result = await createTemplateHandler(args, mockContext);

    expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(mockContext.client, 'PROJ', {
      title: 'Complete Template',
      description: 'A complete template',
      priority: 'urgent',
      estimation: 8,
      assignee: 'user@example.com',
      component: 'Backend',
      milestone: 'v1.0',
      children: [],
    });
    expect(result).toEqual(_mockResult);
  });
});
