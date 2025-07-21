/**
 * ValidateDeletion Tool Tests
 *
 * Tests for the validation deletion checker tool
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies before importing the tool
const mockAnalyzeIssueDeletionImpact = jest.fn();
const mockAnalyzeProjectDeletionImpact = jest.fn();
const mockDeleteComponent = jest.fn();
const mockDeleteMilestone = jest.fn();

jest.unstable_mockModule('../../../../src/core/HulyError.js', () => ({
  HulyError: {
    invalidValue: jest.fn((field, value, expected) => {
      const error = new Error(`Invalid value for field '${field}': ${value}. Expected ${expected}`);
      error.code = 'INVALID_VALUE';
      return error;
    }),
    validation: jest.fn((field, value, message) => {
      const error = new Error(message);
      error.code = 'VALIDATION_ERROR';
      return error;
    }),
  },
}));

// Import after mocks are set up
const { definition, handler, validate } = await import(
  '../../../../src/tools/validation/validateDeletion.js'
);

describe('ValidateDeletion Tool Tests', () => {
  let mockContext;
  let mockClient;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockClient = {};

    mockContext = {
      client: mockClient,
      services: {
        deletionService: {
          analyzeIssueDeletionImpact: mockAnalyzeIssueDeletionImpact,
          analyzeProjectDeletionImpact: mockAnalyzeProjectDeletionImpact,
          deleteComponent: mockDeleteComponent,
          deleteMilestone: mockDeleteMilestone,
        },
      },
      logger: mockLogger,
    };
  });

  describe('Definition', () => {
    test('should have correct tool definition', () => {
      expect(definition.name).toBe('huly_validate_deletion');
      expect(definition.description).toContain('Check if an entity can be safely deleted');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.required).toEqual(['entity_type', 'entity_identifier']);
    });
  });

  describe('Issue Validation', () => {
    test('should validate issue deletion with no blockers', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      mockAnalyzeIssueDeletionImpact.mockResolvedValueOnce({
        issue: { title: 'Test Issue' },
        blockers: [],
        subIssues: [],
        comments: 0,
        attachments: 0,
      });

      const result = await handler(args, mockContext);

      expect(mockAnalyzeIssueDeletionImpact).toHaveBeenCalledWith(mockClient, 'PROJ-123');
      expect(result.content[0].text).toContain('**Can Delete**: ✅ Yes');
      expect(result.content[0].text).toContain('**Entity**: issue - PROJ-123');
      expect(result.content[0].text).toContain('**Name**: Test Issue');
    });

    test('should validate issue deletion with sub-issues', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      mockAnalyzeIssueDeletionImpact.mockResolvedValueOnce({
        issue: { title: 'Parent Issue' },
        blockers: [],
        subIssues: [{ identifier: 'PROJ-124' }, { identifier: 'PROJ-125' }],
        comments: 5,
        attachments: 3,
      });

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('**Can Delete**: ✅ Yes');
      expect(result.content[0].text).toContain('## ⚠️ Warnings');
      expect(result.content[0].text).toContain('Has 2 sub-issues that will be deleted');
      expect(result.content[0].text).toContain('Has 5 comments that will be deleted');
      expect(result.content[0].text).toContain('Has 3 attachments that will be deleted');
      expect(result.content[0].text).toContain('sub issues: 2');
      expect(result.content[0].text).toContain('comments: 5');
      expect(result.content[0].text).toContain('attachments: 3');
    });

    test('should validate issue deletion with blockers', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      mockAnalyzeIssueDeletionImpact.mockResolvedValueOnce({
        issue: { title: 'Blocked Issue' },
        blockers: ['Referenced in PR #456', 'Has active deployments'],
        subIssues: [],
        comments: 0,
        attachments: 0,
      });

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('**Can Delete**: ❌ No');
      expect(result.content[0].text).toContain('## ⚠️ Blockers');
      expect(result.content[0].text).toContain('Referenced in PR #456');
      expect(result.content[0].text).toContain('Has active deployments');
      expect(result.content[0].text).toContain('Use the force option to override blockers');
    });

    test('should handle invalid issue identifier', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'invalid',
      };

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('Invalid value');
      expect(result.content[0].text).toContain('format like "PROJ-123"');
    });
  });

  describe('Project Validation', () => {
    test('should validate project deletion with no blockers', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJ',
      };

      mockAnalyzeProjectDeletionImpact.mockResolvedValueOnce({
        project: { name: 'Test Project' },
        blockers: [],
        issues: [],
        components: [],
        milestones: [],
        templates: [],
      });

      const result = await handler(args, mockContext);

      expect(mockAnalyzeProjectDeletionImpact).toHaveBeenCalledWith(mockClient, 'PROJ');
      expect(result.content[0].text).toContain('**Can Delete**: ✅ Yes');
      expect(result.content[0].text).toContain('**Entity**: project - PROJ');
      expect(result.content[0].text).toContain('**Name**: Test Project');
    });

    test('should validate project deletion with content', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJ',
      };

      mockAnalyzeProjectDeletionImpact.mockResolvedValueOnce({
        project: { name: 'Active Project' },
        blockers: [],
        issues: new Array(50),
        components: new Array(5),
        milestones: new Array(3),
        templates: new Array(10),
      });

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('**Can Delete**: ✅ Yes');
      expect(result.content[0].text).toContain('## ⚠️ Warnings');
      expect(result.content[0].text).toContain('Has 50 issues that will be deleted');
      expect(result.content[0].text).toContain('Has 5 components that will be deleted');
      expect(result.content[0].text).toContain('Has 3 milestones that will be deleted');
      expect(result.content[0].text).toContain('Has 10 templates that will be deleted');
      expect(result.content[0].text).toContain('issues: 50');
      expect(result.content[0].text).toContain('components: 5');
      expect(result.content[0].text).toContain('milestones: 3');
      expect(result.content[0].text).toContain('templates: 10');
    });

    test('should validate project deletion with blockers', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJ',
      };

      mockAnalyzeProjectDeletionImpact.mockResolvedValueOnce({
        project: { name: 'Integrated Project' },
        blockers: ['Has GitHub integration', 'Active webhooks configured'],
        issues: [],
        components: [],
        milestones: [],
        templates: [],
      });

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('**Can Delete**: ❌ No');
      expect(result.content[0].text).toContain('## ⚠️ Blockers');
      expect(result.content[0].text).toContain('Has GitHub integration');
      expect(result.content[0].text).toContain('Active webhooks configured');
    });

    test('should handle invalid project identifier', async () => {
      const args = {
        entity_type: 'project',
        entity_identifier: 'PROJECT-123',
      };

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('Invalid value');
      expect(result.content[0].text).toContain('format like "PROJ"');
    });
  });

  describe('Component Validation', () => {
    test('should validate component deletion with no affected issues', async () => {
      const args = {
        entity_type: 'component',
        entity_identifier: 'Frontend',
        project_identifier: 'PROJ',
      };

      mockDeleteComponent.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '## Dry Run: Component Deletion\n\nAffected issues: 0\n',
          },
        ],
      });

      const result = await handler(args, mockContext);

      expect(mockDeleteComponent).toHaveBeenCalledWith(mockClient, 'PROJ', 'Frontend', {
        dryRun: true,
      });
      expect(result.content[0].text).toContain('**Can Delete**: ✅ Yes');
      expect(result.content[0].text).toContain('**Entity**: component - Frontend');
      // When there are 0 affected issues, it won't appear in the impact summary
      expect(result.content[0].text).not.toContain('affected issues');
    });

    test('should validate component deletion with affected issues', async () => {
      const args = {
        entity_type: 'component',
        entity_identifier: 'Backend',
        project_identifier: 'PROJ',
      };

      mockDeleteComponent.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '## Dry Run: Component Deletion\n\nAffected issues: 15\n',
          },
        ],
      });

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('**Can Delete**: ❌ No');
      expect(result.content[0].text).toContain('## ⚠️ Blockers');
      expect(result.content[0].text).toContain('15 issues use this component');
      expect(result.content[0].text).toContain('affected issues: 15');
    });

    test('should require project identifier for component', async () => {
      const args = {
        entity_type: 'component',
        entity_identifier: 'Frontend',
      };

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain(
        'Project identifier is required for component validation'
      );
    });
  });

  describe('Milestone Validation', () => {
    test('should validate milestone deletion with no affected issues', async () => {
      const args = {
        entity_type: 'milestone',
        entity_identifier: 'v1.0',
        project_identifier: 'PROJ',
      };

      mockDeleteMilestone.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '## Dry Run: Milestone Deletion\n\nAffected issues: 0\n',
          },
        ],
      });

      const result = await handler(args, mockContext);

      expect(mockDeleteMilestone).toHaveBeenCalledWith(mockClient, 'PROJ', 'v1.0', {
        dryRun: true,
      });
      expect(result.content[0].text).toContain('**Can Delete**: ✅ Yes');
      expect(result.content[0].text).toContain('**Entity**: milestone - v1.0');
    });

    test('should validate milestone deletion with affected issues', async () => {
      const args = {
        entity_type: 'milestone',
        entity_identifier: 'v2.0',
        project_identifier: 'PROJ',
      };

      mockDeleteMilestone.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '## Dry Run: Milestone Deletion\n\nAffected issues: 25\n',
          },
        ],
      });

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('**Can Delete**: ❌ No');
      expect(result.content[0].text).toContain('## ⚠️ Blockers');
      expect(result.content[0].text).toContain('25 issues use this milestone');
    });

    test('should require project identifier for milestone', async () => {
      const args = {
        entity_type: 'milestone',
        entity_identifier: 'v1.0',
      };

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain(
        'Project identifier is required for milestone validation'
      );
    });
  });

  describe('Invalid Entity Type', () => {
    test('should handle invalid entity type', async () => {
      const args = {
        entity_type: 'unknown',
        entity_identifier: 'TEST',
      };

      const result = await handler(args, mockContext);

      expect(result.content[0].text).toContain('Invalid value');
      expect(result.content[0].text).toContain('issue, project, component, or milestone');
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors', async () => {
      const args = {
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      };

      mockAnalyzeIssueDeletionImpact.mockRejectedValueOnce(
        new Error('Failed to analyze deletion impact')
      );

      const result = await handler(args, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to validate deletion:',
        expect.any(Error)
      );
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('Failed to analyze deletion impact');
    });
  });

  describe('Validate Function', () => {
    test('should validate required fields', () => {
      const errors = validate({});
      expect(errors).toHaveProperty('entity_type');
      expect(errors).toHaveProperty('entity_identifier');
    });

    test('should validate entity_type values', () => {
      const errors = validate({
        entity_type: 'invalid',
        entity_identifier: 'TEST',
      });
      expect(errors).toHaveProperty('entity_type');
      expect(errors.entity_type).toContain('Must be one of');
    });

    test('should validate empty entity_identifier', () => {
      const errors = validate({
        entity_type: 'issue',
        entity_identifier: '  ',
      });
      expect(errors).toHaveProperty('entity_identifier');
      expect(errors.entity_identifier).toContain('required');
    });

    test('should require project_identifier for component', () => {
      const errors = validate({
        entity_type: 'component',
        entity_identifier: 'Frontend',
      });
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('required for component');
    });

    test('should require project_identifier for milestone', () => {
      const errors = validate({
        entity_type: 'milestone',
        entity_identifier: 'v1.0',
      });
      expect(errors).toHaveProperty('project_identifier');
      expect(errors.project_identifier).toContain('required for component/milestone');
    });

    test('should pass validation for valid issue', () => {
      const errors = validate({
        entity_type: 'issue',
        entity_identifier: 'PROJ-123',
      });
      expect(errors).toBeNull();
    });

    test('should pass validation for valid component', () => {
      const errors = validate({
        entity_type: 'component',
        entity_identifier: 'Frontend',
        project_identifier: 'PROJ',
      });
      expect(errors).toBeNull();
    });
  });
});
