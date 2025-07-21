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

    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Found 2 templates in project Test Project:\n\n📄 **Bug Report Template**\n   ID: template-1\n   Priority: High\n   Estimation: 0 hours\n\n📄 **Feature Template**\n   ID: template-2\n   Priority: Medium\n   Estimation: 0 hours\n   Child templates: 3\n\n',
        },
      ],
    };

    mockTemplateService.listTemplates.mockResolvedValue(mockResponse);

    const result = await listTemplatesHandler(args, mockContext);

    expect(mockTemplateService.listTemplates).toHaveBeenCalledWith(
      mockContext.client,
      'PROJ',
      undefined
    );
    expect(result).toEqual(mockResponse);
  });

  it('should handle empty template list', async () => {
    const args = {
      project_identifier: 'PROJ',
    };

    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'No templates found in project Test Project',
        },
      ],
    };

    mockTemplateService.listTemplates.mockResolvedValue(mockResponse);

    const result = await listTemplatesHandler(args, mockContext);

    expect(result).toEqual(mockResponse);
  });

  it('should apply custom limit', async () => {
    const args = {
      project_identifier: 'PROJ',
      limit: 10,
    };

    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'No templates found in project Test Project',
        },
      ],
    };

    mockTemplateService.listTemplates.mockResolvedValue(mockResponse);

    await listTemplatesHandler(args, mockContext);

    expect(mockTemplateService.listTemplates).toHaveBeenCalledWith(mockContext.client, 'PROJ', 10);
  });

  it('should validate project identifier', async () => {
    // Test the validate function separately from the handler
    const { validate } = await import('../../../src/tools/templates/listTemplates.js');

    const args = {
      project_identifier: '',
    };

    const errors = validate(args);

    expect(errors).toEqual({
      project_identifier: 'Project identifier is required',
    });
  });

  it('should handle service errors', async () => {
    const args = {
      project_identifier: 'PROJ',
    };

    mockTemplateService.listTemplates.mockRejectedValue(new Error('Project not found'));

    const result = await listTemplatesHandler(args, mockContext);

    expect(result.content[0].text).toBe('Error: Project not found');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });

  it('should format templates with all fields', async () => {
    const args = {
      project_identifier: 'PROJ',
    };

    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Found 1 templates in project Test Project:\n\n📄 **Complete Template**\n   ID: template-1\n   Priority: Urgent\n   Estimation: 8 hours\n   Child templates: 2\n\n',
        },
      ],
    };

    mockTemplateService.listTemplates.mockResolvedValue(mockResponse);

    const result = await listTemplatesHandler(args, mockContext);

    expect(result).toEqual(mockResponse);
    expect(result.content[0].text).toContain('Complete Template');
    expect(result.content[0].text).toContain('Priority: Urgent');
    expect(result.content[0].text).toContain('Estimation: 8');
    expect(result.content[0].text).toContain('Child templates: 2');
  });
});
