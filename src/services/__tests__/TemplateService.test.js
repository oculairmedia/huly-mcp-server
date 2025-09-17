/**
 * Unit tests for TemplateService
 */

import { jest } from '@jest/globals';
import TemplateService from '../TemplateService.js';
import { HulyError } from '../../core/HulyError.js';
import { PRIORITY_MAP, DEFAULTS } from '../../core/constants.js';

// Mock Huly modules
jest.mock('@hcengineering/tracker', () => ({
  default: {
    class: {
      Project: 'tracker:class:Project',
      IssueTemplate: 'tracker:class:IssueTemplate',
      Issue: 'tracker:class:Issue',
      IssueStatus: 'tracker:class:IssueStatus',
      Component: 'tracker:class:Component',
      Milestone: 'tracker:class:Milestone',
    },
    attribute: {
      IssueStatus: 'tracker:attribute:IssueStatus',
    },
    ids: {
      NoParent: 'tracker:ids:NoParent',
    },
    taskTypes: {
      Issue: 'tracker:taskType:Issue',
    },
  },
}));

jest.mock('@hcengineering/core', () => ({
  default: {
    class: {
      Account: 'core:class:Account',
    },
    space: {
      Model: 'core:space:Model',
    },
  },
  generateId: jest.fn(() => 'generated-id-123'),
}));

jest.mock('../../core/constants.js', () => ({
  PRIORITY_MAP: {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
    none: 0,
  },
  DEFAULTS: {
    LIST_LIMIT: 50,
  },
}));

jest.mock('../../utils/textExtractor.js', () => ({
  extractTextFromMarkup: jest.fn((markup) => Promise.resolve(`Extracted: ${markup}`)),
}));

jest.mock('../../utils/validators.js', () => ({
  validateEnum: jest.fn((value, field, validValues, defaultValue) => value || defaultValue),
  getValidPriorities: jest.fn(() => ['urgent', 'high', 'medium', 'low', 'none']),
  normalizePriority: jest.fn((value) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (['urgent', 'high', 'medium', 'low', 'none', 'nopriority'].includes(normalized)) {
      return normalized === 'nopriority' ? 'none' : normalized;
    }
    return null;
  }),
}));

describe('TemplateService', () => {
  let templateService;
  let mockClient;
  let mockSequenceService;

  beforeEach(() => {
    mockSequenceService = {
      getNextIssueNumber: jest.fn().mockResolvedValue(42),
    };
    templateService = new TemplateService(mockSequenceService);

    mockClient = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      createDoc: jest.fn(),
      updateDoc: jest.fn(),
      removeDoc: jest.fn(),
      addCollection: jest.fn(),
    };

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance without sequenceService', () => {
      const service = new TemplateService();
      expect(service.sequenceService).toBeNull();
    });

    it('should create instance with sequenceService', () => {
      const service = new TemplateService(mockSequenceService);
      expect(service.sequenceService).toBe(mockSequenceService);
    });
  });

  describe('createTemplate', () => {
    const mockProject = {
      _id: 'project-123',
      name: 'Test Project',
      identifier: 'TEST',
    };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((cls, query) => {
        if (cls === 'tracker:class:Project' && query.identifier === 'TEST') {
          return Promise.resolve(mockProject);
        }
        return Promise.resolve(null);
      });
      mockClient.createDoc.mockResolvedValue('template-123');
    });

    it('should create simple template successfully', async () => {
      const templateData = {
        title: 'Test Template',
        description: 'Test description',
        priority: 'high',
        estimation: 5,
      };

      const result = await templateService.createTemplate(mockClient, 'TEST', templateData);

      expect(mockClient.findOne).toHaveBeenCalledWith('tracker:class:Project', {
        identifier: 'TEST',
      });
      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        expect.objectContaining({
          title: 'Test Template',
          description: 'Test description',
          priority: PRIORITY_MAP.high,
          estimation: 5,
          assignee: null,
          component: null,
          milestone: null,
        })
      );
      expect(result.content[0].text).toContain('✅ Created template "Test Template"');
    });

    it('should create template with assignee', async () => {
      const mockAssignee = { _id: 'user-123', email: 'test@example.com' };
      mockClient.findOne.mockImplementation((cls, query) => {
        if (cls === 'tracker:class:Project') return Promise.resolve(mockProject);
        if (cls === 'core:class:Account' && query.email === 'test@example.com') {
          return Promise.resolve(mockAssignee);
        }
        return Promise.resolve(null);
      });

      const templateData = {
        title: 'Test Template',
        assignee: 'test@example.com',
      };

      await templateService.createTemplate(mockClient, 'TEST', templateData);

      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        expect.objectContaining({
          assignee: 'user-123',
        })
      );
    });

    it('should create template with component and milestone', async () => {
      const mockComponent = { _id: 'comp-123', label: 'Frontend' };
      const mockMilestone = { _id: 'milestone-123', label: 'v1.0' };

      mockClient.findOne.mockImplementation((cls, query) => {
        if (cls === 'tracker:class:Project') return Promise.resolve(mockProject);
        if (cls === 'tracker:class:Component' && query.label === 'Frontend') {
          return Promise.resolve(mockComponent);
        }
        if (cls === 'tracker:class:Milestone' && query.label === 'v1.0') {
          return Promise.resolve(mockMilestone);
        }
        return Promise.resolve(null);
      });

      const templateData = {
        title: 'Test Template',
        component: 'Frontend',
        milestone: 'v1.0',
      };

      await templateService.createTemplate(mockClient, 'TEST', templateData);

      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        expect.objectContaining({
          component: 'comp-123',
          milestone: 'milestone-123',
        })
      );
    });

    it('should create template with children', async () => {
      const templateData = {
        title: 'Parent Template',
        children: [
          {
            title: 'Child Template 1',
            priority: 'high',
            estimation: 2,
          },
          {
            title: 'Child Template 2',
            description: 'Child description',
          },
        ],
      };

      await templateService.createTemplate(mockClient, 'TEST', templateData);

      expect(mockClient.createDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        expect.objectContaining({
          title: 'Parent Template',
          children: expect.arrayContaining([
            expect.objectContaining({
              title: 'Child Template 1',
              priority: PRIORITY_MAP.high,
              estimation: 2,
            }),
            expect.objectContaining({
              title: 'Child Template 2',
              description: 'Child description',
            }),
          ]),
        })
      );
    });

    it('should throw error for non-existent project', async () => {
      mockClient.findOne.mockResolvedValue(null);

      await expect(
        templateService.createTemplate(mockClient, 'INVALID', { title: 'Test' })
      ).rejects.toThrow(HulyError);
    });
  });

  describe('listTemplates', () => {
    const mockProject = { _id: 'project-123', name: 'Test Project' };

    beforeEach(() => {
      mockClient.findOne.mockResolvedValue(mockProject);
    });

    it('should list templates successfully', async () => {
      const mockTemplates = [
        {
          _id: 'template-1',
          title: 'Template 1',
          priority: 2,
          estimation: 5,
          children: [{ title: 'Child 1' }],
        },
        {
          _id: 'template-2',
          title: 'Template 2',
          priority: 3,
          estimation: 0,
          children: [],
        },
      ];

      mockClient.findAll.mockResolvedValue(mockTemplates);

      const result = await templateService.listTemplates(mockClient, 'TEST');

      expect(mockClient.findAll).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        { space: 'project-123' },
        { sort: { modifiedOn: -1 }, limit: DEFAULTS.LIST_LIMIT }
      );
      expect(result.content[0].text).toContain('Found 2 templates');
      expect(result.content[0].text).toContain('Template 1');
      expect(result.content[0].text).toContain('Template 2');
      expect(result.content[0].text).toContain('Child templates: 1');
    });

    it('should handle empty template list', async () => {
      mockClient.findAll.mockResolvedValue([]);

      const result = await templateService.listTemplates(mockClient, 'TEST');

      expect(result.content[0].text).toContain('No templates found');
    });

    it('should respect limit parameter', async () => {
      mockClient.findAll.mockResolvedValue([]);

      await templateService.listTemplates(mockClient, 'TEST', 25);

      expect(mockClient.findAll).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        { space: 'project-123' },
        { sort: { modifiedOn: -1 }, limit: 25 }
      );
    });
  });

  describe('getTemplateDetails', () => {
    const mockTemplate = {
      _id: 'template-123',
      title: 'Detailed Template',
      description: 'Template description',
      priority: 2,
      estimation: 8,
      assignee: 'user-123',
      component: 'comp-123',
      milestone: 'milestone-123',
      space: 'project-123',
      createdOn: Date.now() - 1000000,
      modifiedOn: Date.now(),
      children: [
        {
          title: 'Child Template',
          description: 'Child description',
          priority: 1,
          estimation: 3,
          assignee: 'user-456',
        },
      ],
    };

    const mockProject = { name: 'Test Project' };
    const mockAssignee = { email: 'user@example.com' };
    const mockChildAssignee = { email: 'child@example.com' };
    const mockComponent = { label: 'Frontend' };
    const mockMilestone = { label: 'v1.0' };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((cls, query) => {
        if (cls === 'tracker:class:IssueTemplate') return Promise.resolve(mockTemplate);
        if (cls === 'tracker:class:Project') return Promise.resolve(mockProject);
        if (cls === 'core:class:Account' && query._id === 'user-123')
          return Promise.resolve(mockAssignee);
        if (cls === 'core:class:Account' && query._id === 'user-456')
          return Promise.resolve(mockChildAssignee);
        if (cls === 'tracker:class:Component') return Promise.resolve(mockComponent);
        if (cls === 'tracker:class:Milestone') return Promise.resolve(mockMilestone);
        return Promise.resolve(null);
      });
    });

    it('should get template details successfully', async () => {
      const result = await templateService.getTemplateDetails(mockClient, 'template-123');

      expect(result.content[0].text).toContain('# Template: Detailed Template');
      expect(result.content[0].text).toContain('**Project**: Test Project');
      expect(result.content[0].text).toContain('**Priority**: High');
      expect(result.content[0].text).toContain('**Estimation**: 8 hours');
      expect(result.content[0].text).toContain('**Default Assignee**: user@example.com');
      expect(result.content[0].text).toContain('**Default Component**: Frontend');
      expect(result.content[0].text).toContain('**Default Milestone**: v1.0');
    });

    it('should include child template details', async () => {
      const result = await templateService.getTemplateDetails(mockClient, 'template-123');

      expect(result.content[0].text).toContain('## Child Templates');
      expect(result.content[0].text).toContain('1. **Child Template**');
      expect(result.content[0].text).toContain('Priority: Urgent');
      expect(result.content[0].text).toContain('Estimation: 3 hours');
      expect(result.content[0].text).toContain('Assignee: child@example.com');
    });

    it('should handle template not found', async () => {
      mockClient.findOne.mockResolvedValue(null);

      await expect(templateService.getTemplateDetails(mockClient, 'invalid')).rejects.toThrow(
        HulyError
      );
    });
  });

  describe('updateTemplate', () => {
    const mockTemplate = {
      _id: 'template-123',
      title: 'Original Template',
      space: 'project-123',
    };

    beforeEach(() => {
      mockClient.findOne.mockResolvedValue(mockTemplate);
      mockClient.updateDoc.mockResolvedValue(undefined);
    });

    it('should update template title', async () => {
      const result = await templateService.updateTemplate(
        mockClient,
        'template-123',
        'title',
        'New Title'
      );

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        { title: 'New Title' }
      );
      expect(result.content[0].text).toContain('✅ Updated template');
      expect(result.content[0].text).toContain('title: New Title');
    });

    it('should update template description', async () => {
      await templateService.updateTemplate(
        mockClient,
        'template-123',
        'description',
        'New description'
      );

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        { description: 'New description' }
      );
    });

    it('should update template priority', async () => {
      await templateService.updateTemplate(mockClient, 'template-123', 'priority', 'urgent');

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        { priority: PRIORITY_MAP.urgent }
      );
    });

    it('should update template estimation', async () => {
      await templateService.updateTemplate(mockClient, 'template-123', 'estimation', '10');

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        { estimation: 10 }
      );
    });

    it('should update template assignee', async () => {
      const mockAssignee = { _id: 'user-123' };
      mockClient.findOne.mockImplementation((cls, _query) => {
        if (cls === 'tracker:class:IssueTemplate') return Promise.resolve(mockTemplate);
        if (cls === 'core:class:Account') return Promise.resolve(mockAssignee);
        return Promise.resolve(null);
      });

      await templateService.updateTemplate(
        mockClient,
        'template-123',
        'assignee',
        'test@example.com'
      );

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        { assignee: 'user-123' }
      );
    });

    it('should clear assignee when empty value provided', async () => {
      await templateService.updateTemplate(mockClient, 'template-123', 'assignee', '');

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        { assignee: null }
      );
    });

    it('should throw error for invalid field', async () => {
      await expect(
        templateService.updateTemplate(mockClient, 'template-123', 'invalid_field', 'value')
      ).rejects.toThrow(HulyError);
    });

    it('should throw error for invalid estimation', async () => {
      await expect(
        templateService.updateTemplate(mockClient, 'template-123', 'estimation', 'invalid')
      ).rejects.toThrow(HulyError);
    });
  });

  describe('deleteTemplate', () => {
    const mockTemplate = {
      _id: 'template-123',
      title: 'Template to Delete',
      space: 'project-123',
    };

    beforeEach(() => {
      mockClient.findOne.mockResolvedValue(mockTemplate);
      mockClient.removeDoc.mockResolvedValue(undefined);
    });

    it('should delete template successfully', async () => {
      const result = await templateService.deleteTemplate(mockClient, 'template-123');

      expect(mockClient.removeDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123'
      );
      expect(result.content[0].text).toContain('✅ Deleted template "Template to Delete"');
    });

    it('should throw error for non-existent template', async () => {
      mockClient.findOne.mockResolvedValue(null);

      await expect(templateService.deleteTemplate(mockClient, 'invalid')).rejects.toThrow(
        HulyError
      );
    });
  });

  describe('createIssueFromTemplate', () => {
    const mockTemplate = {
      _id: 'template-123',
      title: 'Template Issue',
      description: 'Template description',
      priority: 2,
      assignee: 'user-123',
      component: 'comp-123',
      milestone: 'milestone-123',
      estimation: 5,
      space: 'project-123',
      children: [
        {
          id: 'child-1',
          title: 'Child Issue',
          description: 'Child description',
          priority: 1,
          assignee: 'user-456',
          estimation: 3,
        },
      ],
    };

    const mockProject = {
      _id: 'project-123',
      identifier: 'TEST',
      defaultIssueStatus: 'status-123',
    };

    beforeEach(() => {
      mockClient.findOne.mockImplementation((cls, _query) => {
        if (cls === 'tracker:class:IssueTemplate') return Promise.resolve(mockTemplate);
        if (cls === 'tracker:class:Project') return Promise.resolve(mockProject);
        return Promise.resolve(null);
      });

      mockClient.addCollection.mockImplementation(() => Promise.resolve('issue-123'));
      mockClient.updateDoc.mockResolvedValue(undefined);
      mockSequenceService.getNextIssueNumber.mockResolvedValueOnce(42).mockResolvedValueOnce(43);
    });

    it('should create issue from template successfully', async () => {
      const result = await templateService.createIssueFromTemplate(mockClient, 'template-123');

      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        'project-123',
        'tracker:ids:NoParent',
        'tracker:class:Issue',
        'subIssues',
        expect.objectContaining({
          title: 'Template Issue',
          description: 'Template description',
          priority: 2,
          assignee: 'user-123',
          component: 'comp-123',
          milestone: 'milestone-123',
          estimation: 5,
          number: 42,
          identifier: 'TEST-42',
        })
      );

      expect(result.content[0].text).toContain('✅ Created 2 issue(s) from template');
      expect(result.content[0].text).toContain('📋 **TEST-42**: Template Issue');
      expect(result.content[0].text).toContain('📋 **TEST-43**: Child Issue');
    });

    it('should apply overrides correctly', async () => {
      const overrides = {
        title: 'Overridden Title',
        priority: 'urgent',
        estimation: 10,
      };

      await templateService.createIssueFromTemplate(mockClient, 'template-123', overrides);

      expect(mockClient.addCollection).toHaveBeenCalledWith(
        'tracker:class:Issue',
        'project-123',
        'tracker:ids:NoParent',
        'tracker:class:Issue',
        'subIssues',
        expect.objectContaining({
          title: 'Overridden Title',
          priority: PRIORITY_MAP.urgent,
          estimation: 10,
          remainingTime: 10,
        })
      );
    });

    it('should skip children when includeChildren is false', async () => {
      const result = await templateService.createIssueFromTemplate(mockClient, 'template-123', {
        includeChildren: false,
      });

      expect(mockClient.addCollection).toHaveBeenCalledTimes(1);
      expect(result.content[0].text).toContain('✅ Created 1 issue(s) from template');
    });

    it('should throw error for non-existent template', async () => {
      mockClient.findOne.mockResolvedValue(null);

      await expect(templateService.createIssueFromTemplate(mockClient, 'invalid')).rejects.toThrow(
        HulyError
      );
    });
  });

  describe('addChildTemplate', () => {
    const mockTemplate = {
      _id: 'template-123',
      title: 'Parent Template',
      space: 'project-123',
    };

    beforeEach(() => {
      mockClient.findOne.mockResolvedValue(mockTemplate);
      mockClient.updateDoc.mockResolvedValue(undefined);
    });

    it('should add child template successfully', async () => {
      const childData = {
        title: 'New Child',
        description: 'Child description',
        priority: 'high',
        estimation: 4,
      };

      const result = await templateService.addChildTemplate(mockClient, 'template-123', childData);

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        {
          $push: {
            children: expect.objectContaining({
              title: 'New Child',
              description: 'Child description',
              priority: PRIORITY_MAP.high,
              estimation: 4,
            }),
          },
        }
      );
      expect(result.content[0].text).toContain('✅ Added child template "New Child"');
    });
  });

  describe('removeChildTemplate', () => {
    const mockTemplate = {
      _id: 'template-123',
      title: 'Parent Template',
      space: 'project-123',
      children: [{ title: 'Child 1' }, { title: 'Child 2' }, { title: 'Child 3' }],
    };

    beforeEach(() => {
      mockClient.findOne.mockResolvedValue(mockTemplate);
      mockClient.updateDoc.mockResolvedValue(undefined);
    });

    it('should remove child template successfully', async () => {
      const result = await templateService.removeChildTemplate(mockClient, 'template-123', '1');

      expect(mockClient.updateDoc).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        'project-123',
        'template-123',
        {
          children: [{ title: 'Child 1' }, { title: 'Child 3' }],
        }
      );
      expect(result.content[0].text).toContain('✅ Removed child template "Child 2"');
    });

    it('should throw error for invalid index', async () => {
      await expect(
        templateService.removeChildTemplate(mockClient, 'template-123', '5')
      ).rejects.toThrow(HulyError);
    });

    it('should throw error for non-numeric index', async () => {
      await expect(
        templateService.removeChildTemplate(mockClient, 'template-123', 'invalid')
      ).rejects.toThrow(HulyError);
    });
  });

  describe('searchTemplates', () => {
    const mockProject = { _id: 'project-123', name: 'Test Project' };
    const mockTemplates = [
      {
        _id: 'template-1',
        title: 'Search Result 1',
        priority: 2,
        estimation: 5,
        space: 'project-123',
        children: [],
      },
      {
        _id: 'template-2',
        title: 'Search Result 2',
        priority: 1,
        estimation: 8,
        space: 'project-123',
        children: [{ title: 'Child' }],
      },
    ];

    beforeEach(() => {
      mockClient.findOne.mockResolvedValue(mockProject);
      mockClient.findAll.mockResolvedValue(mockTemplates);
    });

    it('should search templates with query and project', async () => {
      const result = await templateService.searchTemplates(mockClient, 'search term', 'TEST', 25);

      expect(mockClient.findAll).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        {
          space: 'project-123',
          $search: 'search term',
        },
        {
          sort: { modifiedOn: -1 },
          limit: 25,
        }
      );
      expect(result.content[0].text).toContain('Found 2 templates');
      expect(result.content[0].text).toContain('Search Result 1');
      expect(result.content[0].text).toContain('Search Result 2');
      expect(result.content[0].text).toContain('Child templates: 1');
    });

    it('should search templates without project filter', async () => {
      await templateService.searchTemplates(mockClient, 'search term');

      expect(mockClient.findAll).toHaveBeenCalledWith(
        'tracker:class:IssueTemplate',
        { $search: 'search term' },
        {
          sort: { modifiedOn: -1 },
          limit: DEFAULTS.LIST_LIMIT,
        }
      );
    });

    it('should handle empty search results', async () => {
      mockClient.findAll.mockResolvedValue([]);

      const result = await templateService.searchTemplates(mockClient, 'no results');

      expect(result.content[0].text).toContain('No templates found matching the search criteria');
    });
  });

  describe('helper methods', () => {
    describe('_getNextIssueNumber', () => {
      it('should use SequenceService when available', async () => {
        const result = await templateService._getNextIssueNumber(mockClient, 'project-123');

        expect(mockSequenceService.getNextIssueNumber).toHaveBeenCalledWith(
          mockClient,
          'project-123'
        );
        expect(result).toBe(42);
      });

      it('should fallback to manual method when SequenceService unavailable', async () => {
        templateService.sequenceService = null;
        const mockLastIssue = { number: 99 };
        mockClient.findOne.mockResolvedValue(mockLastIssue);

        const result = await templateService._getNextIssueNumber(mockClient, 'project-123');

        expect(mockClient.findOne).toHaveBeenCalledWith(
          'tracker:class:Issue',
          { space: 'project-123' },
          { sort: { number: -1 } }
        );
        expect(result).toBe(100);
      });

      it('should return 1 when no issues exist', async () => {
        templateService.sequenceService = null;
        mockClient.findOne.mockResolvedValue(null);

        const result = await templateService._getNextIssueNumber(mockClient, 'project-123');

        expect(result).toBe(1);
      });
    });

    describe('_getDefaultStatus', () => {
      const mockProject = {
        _id: 'project-123',
        defaultIssueStatus: 'default-status-123',
      };

      it('should return project default status', async () => {
        mockClient.findOne.mockResolvedValue(mockProject);

        const result = await templateService._getDefaultStatus(mockClient, 'project-123');

        expect(result).toBe('default-status-123');
      });

      it('should fallback to Backlog status', async () => {
        const projectWithoutDefault = { _id: 'project-123' };
        const backlogStatus = { _id: 'backlog-status-123' };

        mockClient.findOne.mockImplementation((cls, query) => {
          if (cls === 'tracker:class:Project') return Promise.resolve(projectWithoutDefault);
          if (cls === 'tracker:class:IssueStatus' && query.name === 'Backlog') {
            return Promise.resolve(backlogStatus);
          }
          return Promise.resolve(null);
        });

        const result = await templateService._getDefaultStatus(mockClient, 'project-123');

        expect(result).toBe('backlog-status-123');
      });

      it('should fallback to any status when Backlog not found', async () => {
        const projectWithoutDefault = { _id: 'project-123' };
        const anyStatus = { _id: 'any-status-123' };

        mockClient.findOne.mockImplementation((cls, query) => {
          if (cls === 'tracker:class:Project') return Promise.resolve(projectWithoutDefault);
          if (query.name === 'Backlog') return Promise.resolve(null);
          if (query.ofAttribute === 'tracker:attribute:IssueStatus') {
            return Promise.resolve(anyStatus);
          }
          return Promise.resolve(null);
        });

        const result = await templateService._getDefaultStatus(mockClient, 'project-123');

        expect(result).toBe('any-status-123');
      });

      it('should throw error when no statuses exist', async () => {
        mockClient.findOne.mockResolvedValue(null);

        await expect(templateService._getDefaultStatus(mockClient, 'project-123')).rejects.toThrow(
          HulyError
        );
      });
    });

    describe('resolver methods', () => {
      it('should resolve assignee by email', async () => {
        const mockAssignee = { _id: 'user-123' };
        mockClient.findOne.mockResolvedValue(mockAssignee);

        const result = await templateService._resolveAssignee(mockClient, 'test@example.com');

        expect(mockClient.findOne).toHaveBeenCalledWith('core:class:Account', {
          email: 'test@example.com',
        });
        expect(result).toBe('user-123');
      });

      it('should return null for empty email', async () => {
        const result = await templateService._resolveAssignee(mockClient, '');
        expect(result).toBeNull();
      });

      it('should resolve component by label', async () => {
        const mockComponent = { _id: 'comp-123' };
        mockClient.findOne.mockResolvedValue(mockComponent);

        const result = await templateService._resolveComponent(
          mockClient,
          'project-123',
          'Frontend'
        );

        expect(mockClient.findOne).toHaveBeenCalledWith('tracker:class:Component', {
          space: 'project-123',
          label: 'Frontend',
        });
        expect(result).toBe('comp-123');
      });

      it('should resolve milestone by label', async () => {
        const mockMilestone = { _id: 'milestone-123' };
        mockClient.findOne.mockResolvedValue(mockMilestone);

        const result = await templateService._resolveMilestone(mockClient, 'project-123', 'v1.0');

        expect(mockClient.findOne).toHaveBeenCalledWith('tracker:class:Milestone', {
          space: 'project-123',
          label: 'v1.0',
        });
        expect(result).toBe('milestone-123');
      });
    });
  });
});
