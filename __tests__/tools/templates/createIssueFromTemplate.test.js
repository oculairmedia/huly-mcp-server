import { jest } from '@jest/globals';
import { handler as createIssueFromTemplateHandler } from '../../../src/tools/templates/createIssueFromTemplate.js';

describe('createIssueFromTemplate tool', () => {
  let mockContext;
  let mockTemplateService;

  beforeEach(() => {
    mockTemplateService = {
      createIssueFromTemplate: jest.fn(),
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

  it('should create issue from template', async () => {
    const args = {
      template_id: 'template-123',
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created 1 issue(s) from template "Bug Template"\n\n📋 **PROJ-100**: Bug Report\n',
        },
      ],
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(_mockResult);

    const result = await createIssueFromTemplateHandler(args, mockContext);

    expect(mockTemplateService.createIssueFromTemplate).toHaveBeenCalledWith(
      mockContext.client,
      'template-123',
      {
        includeChildren: true,
      }
    );
    expect(result).toEqual(_mockResult);
  });

  it('should create issue with children', async () => {
    const args = {
      template_id: 'template-123',
      include_children: true,
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created 4 issue(s) from template "Feature Template"\n\n📋 **PROJ-100**: Feature Implementation\n📋 **PROJ-101**: Sub Issue 1\n   Parent: PROJ-100\n📋 **PROJ-102**: Sub Issue 2\n   Parent: PROJ-100\n📋 **PROJ-103**: Sub Issue 3\n   Parent: PROJ-100\n',
        },
      ],
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(_mockResult);

    const result = await createIssueFromTemplateHandler(args, mockContext);

    expect(result).toEqual(_mockResult);
  });

  it('should override template values', async () => {
    const args = {
      template_id: 'template-123',
      title: 'Custom Title',
      priority: 'urgent',
      component: 'Frontend',
      milestone: 'v2.0',
      assignee: 'user@example.com',
      estimation: 5,
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created 1 issue(s) from template "Custom Template"\n\n📋 **PROJ-100**: Custom Title\n',
        },
      ],
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(_mockResult);

    const result = await createIssueFromTemplateHandler(args, mockContext);

    expect(mockTemplateService.createIssueFromTemplate).toHaveBeenCalledWith(
      mockContext.client,
      'template-123',
      {
        title: 'Custom Title',
        priority: 'urgent',
        estimation: 5,
        assignee: 'user@example.com',
        component: 'Frontend',
        milestone: 'v2.0',
        includeChildren: true,
      }
    );
    expect(result).toEqual(_mockResult);
  });

  it('should skip children when requested', async () => {
    const args = {
      template_id: 'template-123',
      include_children: false,
    };

    const _mockResult = {
      content: [
        {
          type: 'text',
          text: '✅ Created 1 issue(s) from template "Parent Template"\n\n📋 **PROJ-100**: Parent Issue Only\n',
        },
      ],
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(_mockResult);

    await createIssueFromTemplateHandler(args, mockContext);

    expect(mockTemplateService.createIssueFromTemplate).toHaveBeenCalledWith(
      mockContext.client,
      'template-123',
      expect.objectContaining({
        includeChildren: false,
      })
    );
  });

  it('should handle creation failure', async () => {
    const args = {
      template_id: 'template-123',
    };

    mockTemplateService.createIssueFromTemplate.mockRejectedValue(new Error('Template not found'));

    const result = await createIssueFromTemplateHandler(args, mockContext);

    expect(result.content[0].text).toBe('Error: Template not found');
    expect(mockContext.logger.error).toHaveBeenCalled();
  });

  it('should validate template ID', async () => {
    // Test the validate function separately from the handler
    const { validate } = await import('../../../src/tools/templates/createIssueFromTemplate.js');

    const args = {
      template_id: '',
    };

    const errors = validate(args);

    expect(errors).toEqual({
      template_id: 'Template ID is required',
    });
  });

  it('should validate estimation value', async () => {
    // Test the validate function separately from the handler
    const { validate } = await import('../../../src/tools/templates/createIssueFromTemplate.js');

    const args = {
      template_id: 'template-123',
      estimation: -5,
    };

    const errors = validate(args);

    expect(errors).toEqual({
      estimation: 'Estimation must be a non-negative number',
    });
  });
});
