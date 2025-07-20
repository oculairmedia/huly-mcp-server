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

    const mockResult = {
      success: true,
      issueId: 'issue-123',
      identifier: 'PROJ-100',
      title: 'Bug Report',
      childrenCreated: 0,
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(mockResult);

    const result = await createIssueFromTemplateHandler(args, mockContext);

    expect(mockTemplateService.createIssueFromTemplate).toHaveBeenCalledWith(
      mockContext.client,
      'template-123',
      {
        includeChildren: true,
        title: undefined,
        priority: undefined,
        estimation: undefined,
        assignee: undefined,
        component: undefined,
        milestone: undefined,
      }
    );
    expect(result).toContain('✅ Issue created successfully');
    expect(result).toContain('Issue: Bug Report (PROJ-100)');
  });

  it('should create issue with children', async () => {
    const args = {
      template_id: 'template-123',
      include_children: true,
    };

    const mockResult = {
      success: true,
      issueId: 'issue-123',
      identifier: 'PROJ-100',
      title: 'Feature Implementation',
      childrenCreated: 3,
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(mockResult);

    const result = await createIssueFromTemplateHandler(args, mockContext);

    expect(result).toContain('✅ Issue created successfully');
    expect(result).toContain('Created 3 sub-issues from template children');
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

    const mockResult = {
      success: true,
      issueId: 'issue-123',
      identifier: 'PROJ-100',
      title: 'Custom Title',
      childrenCreated: 0,
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(mockResult);

    const result = await createIssueFromTemplateHandler(args, mockContext);

    expect(mockTemplateService.createIssueFromTemplate).toHaveBeenCalledWith(
      mockContext.client,
      'template-123',
      {
        includeChildren: true,
        title: 'Custom Title',
        priority: 'urgent',
        estimation: 5,
        assignee: 'user@example.com',
        component: 'Frontend',
        milestone: 'v2.0',
      }
    );
    expect(result).toContain('Custom Title');
  });

  it('should skip children when requested', async () => {
    const args = {
      template_id: 'template-123',
      include_children: false,
    };

    const mockResult = {
      success: true,
      issueId: 'issue-123',
      identifier: 'PROJ-100',
      title: 'Parent Issue Only',
      childrenCreated: 0,
    };

    mockTemplateService.createIssueFromTemplate.mockResolvedValue(mockResult);

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

    mockTemplateService.createIssueFromTemplate.mockRejectedValue(
      new Error('Template not found')
    );

    await expect(createIssueFromTemplateHandler(args, mockContext)).rejects.toThrow(
      'Template not found'
    );
    expect(mockContext.logger.error).toHaveBeenCalled();
  });

  it('should validate template ID', async () => {
    const args = {
      template_id: '',
    };

    await expect(createIssueFromTemplateHandler(args, mockContext)).rejects.toThrow(
      'Template ID is required'
    );
  });

  it('should validate priority value', async () => {
    const args = {
      template_id: 'template-123',
      priority: 'invalid',
    };

    await expect(createIssueFromTemplateHandler(args, mockContext)).rejects.toThrow(
      'Invalid priority value'
    );
  });
});