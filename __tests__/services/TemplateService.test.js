import { jest } from '@jest/globals';
import TemplateService from '../../src/services/TemplateService.js';
import { createLoggerWithConfig } from '../../src/utils/logger.js';

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  createLoggerWithConfig: jest.fn(),
}));

describe('TemplateService', () => {
  let templateService;
  let mockClient;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    createLoggerWithConfig.mockReturnValue(mockLogger);

    mockClient = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      addCollection: jest.fn(),
      removeCollection: jest.fn(),
      update: jest.fn(),
      createDoc: jest.fn(),
    };

    templateService = new TemplateService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTemplate', () => {
    const projectIdentifier = 'PROJ';
    const mockProject = {
      _id: 'project-123',
      _class: 'tracker:class:Project',
      identifier: projectIdentifier,
      name: 'Test Project',
    };

    it('should create a simple template', async () => {
      const templateData = {
        title: 'Bug Report Template',
        description: 'Standard bug report template',
        priority: 'medium',
      };

      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.createDoc.mockResolvedValueOnce('template-123');

      const result = await templateService.createTemplate(
        mockClient,
        projectIdentifier,
        templateData
      );

      expect(result.success).toBe(true);
      expect(result.templateId).toBe('template-123');
      expect(result.title).toBe('Bug Report Template');
      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        expect.objectContaining({
          title: 'Bug Report Template',
          description: 'Standard bug report template',
          priority: 'medium',
          space: mockProject._id,
        })
      );
    });

    it('should create template with child templates', async () => {
      const templateData = {
        title: 'Feature Template',
        description: 'Feature implementation template',
        priority: 'high',
        children: [
          {
            title: 'Design subtask',
            description: 'Design the feature',
            priority: 'high',
          },
          {
            title: 'Implementation subtask',
            description: 'Implement the feature',
            priority: 'medium',
          },
        ],
      };

      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.createDoc.mockResolvedValueOnce('template-123');
      mockClient.addCollection.mockResolvedValue(true);

      const result = await templateService.createTemplate(
        mockClient,
        projectIdentifier,
        templateData
      );

      expect(result.success).toBe(true);
      expect(result.templateId).toBe('template-123');
      expect(result.childrenCreated).toBe(2);
      expect(mockClient.addCollection).toHaveBeenCalledTimes(2);
    });

    it('should handle project not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        templateService.createTemplate(mockClient, projectIdentifier, {
          title: 'Test Template',
        })
      ).rejects.toThrow('Project not found: PROJ');
    });

    it('should validate required fields', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject);

      await expect(
        templateService.createTemplate(mockClient, projectIdentifier, {})
      ).rejects.toThrow('Template title is required');
    });

    it('should handle assignee resolution', async () => {
      const templateData = {
        title: 'Assigned Template',
        assignee: 'user@example.com',
      };

      const mockUser = {
        _id: 'user-123',
        email: 'user@example.com',
      };

      mockClient.findOne.mockResolvedValueOnce(mockProject).mockResolvedValueOnce(mockUser);
      mockClient.createDoc.mockResolvedValueOnce('template-123');

      const result = await templateService.createTemplate(
        mockClient,
        projectIdentifier,
        templateData
      );

      expect(result.success).toBe(true);
      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        expect.objectContaining({
          assignee: 'user-123',
        })
      );
    });
  });

  describe('listTemplates', () => {
    const projectIdentifier = 'PROJ';
    const mockProject = {
      _id: 'project-123',
      _class: 'tracker:class:Project',
      identifier: projectIdentifier,
    };

    it('should list all templates in a project', async () => {
      const mockTemplates = [
        {
          _id: 'template-1',
          title: 'Bug Template',
          description: 'Bug report template',
          priority: 'high',
        },
        {
          _id: 'template-2',
          title: 'Feature Template',
          description: 'Feature request template',
          priority: 'medium',
        },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll.mockResolvedValueOnce(mockTemplates);

      const result = await templateService.listTemplates(mockClient, projectIdentifier);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Bug Template');
      expect(result[1].title).toBe('Feature Template');
      expect(mockClient.findAll).toHaveBeenCalledWith('tracker:class:IssueTemplate', {
        space: mockProject._id,
      });
    });

    it('should handle empty template list', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll.mockResolvedValueOnce([]);

      const result = await templateService.listTemplates(mockClient, projectIdentifier);

      expect(result).toEqual([]);
    });

    it('should apply limit parameter', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll.mockResolvedValueOnce([]);

      await templateService.listTemplates(mockClient, projectIdentifier, 10);

      expect(mockClient.findAll).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        { space: mockProject._id },
        { limit: 10 }
      );
    });
  });

  describe('getTemplateDetails', () => {
    const templateId = 'template-123';

    it('should get template with children', async () => {
      const mockTemplate = {
        _id: templateId,
        title: 'Parent Template',
        description: 'Parent template description',
        priority: 'high',
      };

      const mockChildren = [
        {
          _id: 'child-1',
          title: 'Child 1',
          description: 'First child',
        },
        {
          _id: 'child-2',
          title: 'Child 2',
          description: 'Second child',
        },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce(mockChildren);

      const result = await templateService.getTemplateDetails(mockClient, templateId);

      expect(result._id).toBe(templateId);
      expect(result.title).toBe('Parent Template');
      expect(result.children).toHaveLength(2);
      expect(result.children[0].title).toBe('Child 1');
    });

    it('should handle template not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(templateService.getTemplateDetails(mockClient, templateId)).rejects.toThrow(
        'Template not found: template-123'
      );
    });

    it('should handle template with no children', async () => {
      const mockTemplate = {
        _id: templateId,
        title: 'Simple Template',
      };

      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce([]);

      const result = await templateService.getTemplateDetails(mockClient, templateId);

      expect(result.children).toEqual([]);
    });
  });

  describe('createIssueFromTemplate', () => {
    const templateId = 'template-123';
    const mockTemplate = {
      _id: templateId,
      _class: 'tracker:class:IssueTemplate',
      title: 'Bug Report Template',
      description: 'Standard bug report',
      priority: 'medium',
      space: 'project-123',
    };

    it('should create issue from simple template', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce([]); // No children
      mockClient.createDoc.mockResolvedValueOnce('issue-123');

      const mockIssue = {
        _id: 'issue-123',
        identifier: 'PROJ-100',
      };
      mockClient.findOne.mockResolvedValueOnce(mockIssue);

      const result = await templateService.createIssueFromTemplate(mockClient, templateId);

      expect(result.success).toBe(true);
      expect(result.issueId).toBe('issue-123');
      expect(result.identifier).toBe('PROJ-100');
      expect(result.childrenCreated).toBe(0);
    });

    it('should create issue with children from template', async () => {
      const mockChildren = [
        {
          _id: 'child-template-1',
          title: 'Design',
          description: 'Design task',
          priority: 'high',
        },
        {
          _id: 'child-template-2',
          title: 'Implementation',
          description: 'Implementation task',
          priority: 'medium',
        },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce(mockChildren);

      // Parent issue creation
      mockClient.createDoc.mockResolvedValueOnce('issue-123');
      const mockParentIssue = {
        _id: 'issue-123',
        identifier: 'PROJ-100',
      };
      mockClient.findOne.mockResolvedValueOnce(mockParentIssue);

      // Child issues creation
      mockClient.createDoc.mockResolvedValueOnce('child-issue-1');
      mockClient.createDoc.mockResolvedValueOnce('child-issue-2');

      const result = await templateService.createIssueFromTemplate(mockClient, templateId, {
        includeChildren: true,
      });

      expect(result.success).toBe(true);
      expect(result.childrenCreated).toBe(2);
      expect(mockClient.createDoc).toHaveBeenCalledTimes(3); // Parent + 2 children
    });

    it('should override template values', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce([]);
      mockClient.createDoc.mockResolvedValueOnce('issue-123');

      const mockIssue = {
        _id: 'issue-123',
        identifier: 'PROJ-100',
      };
      mockClient.findOne.mockResolvedValueOnce(mockIssue);

      const overrides = {
        title: 'Custom Title',
        priority: 'urgent',
        component: 'Frontend',
      };

      await templateService.createIssueFromTemplate(mockClient, templateId, overrides);

      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'tracker:class:Issue',
        expect.objectContaining({
          title: 'Custom Title',
          priority: 'urgent',
          component: 'Frontend',
        })
      );
    });

    it('should skip children when includeChildren is false', async () => {
      const mockChildren = [
        { _id: 'child-1', title: 'Child 1' },
        { _id: 'child-2', title: 'Child 2' },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce(mockChildren);
      mockClient.createDoc.mockResolvedValueOnce('issue-123');

      const mockIssue = {
        _id: 'issue-123',
        identifier: 'PROJ-100',
      };
      mockClient.findOne.mockResolvedValueOnce(mockIssue);

      const result = await templateService.createIssueFromTemplate(mockClient, templateId, {
        includeChildren: false,
      });

      expect(result.childrenCreated).toBe(0);
      expect(mockClient.createDoc).toHaveBeenCalledTimes(1); // Only parent
    });
  });

  describe('updateTemplate', () => {
    const templateId = 'template-123';
    const mockTemplate = {
      _id: templateId,
      title: 'Original Title',
      description: 'Original description',
      priority: 'medium',
    };

    it('should update template title', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.update.mockResolvedValueOnce(true);

      const result = await templateService.updateTemplate(
        mockClient,
        templateId,
        'title',
        'New Title'
      );

      expect(result.success).toBe(true);
      expect(result.field).toBe('title');
      expect(result.oldValue).toBe('Original Title');
      expect(result.newValue).toBe('New Title');
      expect(mockClient.update).toHaveBeenCalledWith(mockTemplate, { title: 'New Title' });
    });

    it('should update template priority', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.update.mockResolvedValueOnce(true);

      const result = await templateService.updateTemplate(
        mockClient,
        templateId,
        'priority',
        'high'
      );

      expect(result.success).toBe(true);
      expect(result.oldValue).toBe('medium');
      expect(result.newValue).toBe('high');
    });

    it('should handle invalid field', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockTemplate);

      await expect(
        templateService.updateTemplate(mockClient, templateId, 'invalid', 'value')
      ).rejects.toThrow('Invalid field: invalid');
    });

    it('should handle template not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        templateService.updateTemplate(mockClient, templateId, 'title', 'New Title')
      ).rejects.toThrow('Template not found: template-123');
    });
  });

  describe('deleteTemplate', () => {
    const templateId = 'template-123';
    const mockTemplate = {
      _id: templateId,
      _class: 'tracker:class:IssueTemplate',
      title: 'Template to Delete',
    };

    it('should delete template with children', async () => {
      const mockChildren = [
        { _id: 'child-1', attachedTo: templateId },
        { _id: 'child-2', attachedTo: templateId },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce(mockChildren);
      mockClient.removeCollection.mockResolvedValue(true);

      const result = await templateService.deleteTemplate(mockClient, templateId);

      expect(result.success).toBe(true);
      expect(result.deletedChildren).toBe(2);
      expect(mockClient.removeCollection).toHaveBeenCalledTimes(3); // Parent + 2 children
    });

    it('should delete template without children', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockTemplate);
      mockClient.findAll.mockResolvedValueOnce([]);
      mockClient.removeCollection.mockResolvedValue(true);

      const result = await templateService.deleteTemplate(mockClient, templateId);

      expect(result.success).toBe(true);
      expect(result.deletedChildren).toBe(0);
      expect(mockClient.removeCollection).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchTemplates', () => {
    it('should search templates by query', async () => {
      const mockTemplates = [
        {
          _id: 'template-1',
          title: 'Bug Report Template',
          description: 'For reporting bugs',
        },
        {
          _id: 'template-2',
          title: 'Feature Request',
          description: 'Request new features',
        },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockTemplates);

      const result = await templateService.searchTemplates(mockClient, 'bug');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Bug Report Template');
    });

    it('should search in both title and description', async () => {
      const mockTemplates = [
        {
          _id: 'template-1',
          title: 'Standard Template',
          description: 'Template for bug reports',
        },
        {
          _id: 'template-2',
          title: 'Bug Template',
          description: 'Standard template',
        },
      ];

      mockClient.findAll.mockResolvedValueOnce(mockTemplates);

      const result = await templateService.searchTemplates(mockClient, 'bug');

      expect(result).toHaveLength(2); // Both match 'bug'
    });

    it('should limit search results', async () => {
      const mockTemplates = Array.from({ length: 20 }, (_, i) => ({
        _id: `template-${i}`,
        title: `Bug Template ${i}`,
        description: 'Bug report',
      }));

      mockClient.findAll.mockResolvedValueOnce(mockTemplates);

      const result = await templateService.searchTemplates(mockClient, 'bug', null, 5);

      expect(result).toHaveLength(5);
    });

    it('should filter by project', async () => {
      const projectIdentifier = 'PROJ';
      const mockProject = {
        _id: 'project-123',
        identifier: projectIdentifier,
      };

      mockClient.findOne.mockResolvedValueOnce(mockProject);
      mockClient.findAll.mockResolvedValueOnce([]);

      await templateService.searchTemplates(mockClient, 'test', projectIdentifier);

      expect(mockClient.findAll).toHaveBeenCalledWith('tracker:class:IssueTemplate', {
        space: 'project-123',
      });
    });
  });

  describe('addChildTemplate', () => {
    const parentId = 'parent-123';
    const mockParent = {
      _id: parentId,
      _class: 'tracker:class:IssueTemplate',
      title: 'Parent Template',
    };

    it('should add child template to parent', async () => {
      const childData = {
        title: 'New Child',
        description: 'Child template',
        priority: 'high',
      };

      mockClient.findOne.mockResolvedValueOnce(mockParent);
      mockClient.addCollection.mockResolvedValue(true);

      const result = await templateService.addChildTemplate(mockClient, parentId, childData);

      expect(result.success).toBe(true);
      expect(result.parentId).toBe(parentId);
      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:IssueTemplateChild',
        parentId,
        mockParent._id,
        mockParent._class,
        'children',
        expect.objectContaining({
          title: 'New Child',
          description: 'Child template',
          priority: 'high',
        })
      );
    });

    it('should handle parent not found', async () => {
      mockClient.findOne.mockResolvedValueOnce(null);

      await expect(
        templateService.addChildTemplate(mockClient, parentId, { title: 'Child' })
      ).rejects.toThrow('Parent template not found: parent-123');
    });
  });

  describe('removeChildTemplate', () => {
    const parentId = 'parent-123';
    const mockParent = {
      _id: parentId,
      _class: 'tracker:class:IssueTemplate',
    };

    it('should remove child template by index', async () => {
      const mockChildren = [
        { _id: 'child-1', title: 'Child 1' },
        { _id: 'child-2', title: 'Child 2' },
        { _id: 'child-3', title: 'Child 3' },
      ];

      mockClient.findOne.mockResolvedValueOnce(mockParent);
      mockClient.findAll.mockResolvedValueOnce(mockChildren);
      mockClient.removeCollection.mockResolvedValue(true);

      const result = await templateService.removeChildTemplate(mockClient, parentId, 1);

      expect(result.success).toBe(true);
      expect(result.removedChild.title).toBe('Child 2');
      expect(mockClient.removeCollection).toHaveBeenCalledWith(
        mockChildren[1]._class,
        mockChildren[1]._id
      );
    });

    it('should handle invalid index', async () => {
      mockClient.findOne.mockResolvedValueOnce(mockParent);
      mockClient.findAll.mockResolvedValueOnce([{ _id: 'child-1' }]);

      await expect(templateService.removeChildTemplate(mockClient, parentId, 5)).rejects.toThrow(
        'Invalid child index: 5'
      );
    });
  });
});
