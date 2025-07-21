/**
 * Integration test for bulk create issues with component and milestone assignment
 */

import { jest } from '@jest/globals';
import { handler } from '../../src/tools/issues/bulkCreateIssues.js';

describe('Bulk Create Issues Component/Milestone Integration', () => {
  let mockContext;
  let mockIssueService;
  let createIssueCalls = [];
  let createSubissueCalls = [];

  beforeEach(() => {
    jest.clearAllMocks();
    createIssueCalls = [];
    createSubissueCalls = [];

    mockIssueService = {
      createIssue: jest.fn().mockImplementation((...args) => {
        createIssueCalls.push(args);
        const num = createIssueCalls.length;
        return Promise.resolve({
          content: [{ text: `Created issue TEST-${num}` }],
          data: {
            identifier: `TEST-${num}`,
            project: 'TEST',
            status: 'Backlog',
            priority: args[4] || 'medium',
          },
        });
      }),
      createSubissue: jest.fn().mockImplementation((...args) => {
        createSubissueCalls.push(args);
        const num = 100 + createSubissueCalls.length;
        return Promise.resolve({
          content: [{ text: `Created subissue TEST-${num}` }],
          data: {
            identifier: `TEST-${num}`,
            project: 'TEST',
            status: 'Backlog',
            priority: args[4] || 'medium',
          },
        });
      }),
    };

    mockContext = {
      client: {},
      services: {
        issueService: mockIssueService,
      },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
      },
    };
  });

  it('should pass component and milestone to createIssue for each issue', async () => {
    const args = {
      project_identifier: 'TEST',
      issues: [
        {
          title: 'Issue 1',
          description: 'Description 1',
          priority: 'high',
          component: 'Frontend',
          milestone: 'Version 1.0',
        },
        {
          title: 'Issue 2',
          description: 'Description 2',
          priority: 'medium',
          component: 'Backend',
          milestone: 'Version 2.0',
        },
        {
          title: 'Issue 3',
          description: 'Description 3',
          // No component/milestone
        },
      ],
    };

    const result = await handler(args, mockContext);

    // Check that all issues were created
    expect(createIssueCalls).toHaveLength(3);

    // Verify first issue
    expect(createIssueCalls[0]).toEqual([
      mockContext.client,
      'TEST',
      'Issue 1',
      'Description 1',
      'high',
      'Frontend',
      'Version 1.0',
    ]);

    // Verify second issue
    expect(createIssueCalls[1]).toEqual([
      mockContext.client,
      'TEST',
      'Issue 2',
      'Description 2',
      'medium',
      'Backend',
      'Version 2.0',
    ]);

    // Verify third issue (no component/milestone)
    expect(createIssueCalls[2]).toEqual([
      mockContext.client,
      'TEST',
      'Issue 3',
      'Description 3',
      'medium', // Default priority
      null,
      null,
    ]);

    // Verify response
    const responseData = JSON.parse(result.content[0].text);
    expect(responseData.success).toBe(true);
    expect(responseData.summary.total).toBe(3);
    expect(responseData.summary.succeeded).toBe(3);
    expect(responseData.created_issues).toHaveLength(3);
  });

  it('should pass component and milestone to createSubissue', async () => {
    const args = {
      project_identifier: 'TEST',
      issues: [
        {
          parent_issue: 'TEST-1',
          title: 'Subissue 1',
          description: 'Sub description',
          priority: 'low',
          component: 'Testing',
          milestone: 'Sprint 1',
        },
        {
          parent_issue: 'TEST-1',
          title: 'Subissue 2',
          description: 'Sub description 2',
          // Inherit from parent
        },
      ],
    };

    await handler(args, mockContext);

    expect(createSubissueCalls).toHaveLength(2);

    // Verify first subissue
    expect(createSubissueCalls[0]).toEqual([
      mockContext.client,
      'TEST-1',
      'Subissue 1',
      'Sub description',
      'low',
      'Testing',
      'Sprint 1',
    ]);

    // Verify second subissue
    expect(createSubissueCalls[1]).toEqual([
      mockContext.client,
      'TEST-1',
      'Subissue 2',
      'Sub description 2',
      'medium', // Default priority
      null,
      null,
    ]);
  });

  it('should apply defaults for component and milestone', async () => {
    const args = {
      project_identifier: 'TEST',
      defaults: {
        component: 'Default Component',
        milestone: 'Default Milestone',
        priority: 'high',
      },
      issues: [
        {
          title: 'Issue 1',
          description: 'Description 1',
          // Use all defaults
        },
        {
          title: 'Issue 2',
          description: 'Description 2',
          component: 'Override Component', // Override component only
        },
        {
          title: 'Issue 3',
          description: 'Description 3',
          milestone: 'Override Milestone', // Override milestone only
          priority: 'low', // Override priority
        },
      ],
    };

    await handler(args, mockContext);

    expect(createIssueCalls).toHaveLength(3);

    // First issue uses all defaults
    expect(createIssueCalls[0][5]).toBe('Default Component');
    expect(createIssueCalls[0][6]).toBe('Default Milestone');
    expect(createIssueCalls[0][4]).toBe('high');

    // Second issue overrides component
    expect(createIssueCalls[1][5]).toBe('Override Component');
    expect(createIssueCalls[1][6]).toBe('Default Milestone');
    expect(createIssueCalls[1][4]).toBe('high');

    // Third issue overrides milestone and priority
    expect(createIssueCalls[2][5]).toBe('Default Component');
    expect(createIssueCalls[2][6]).toBe('Override Milestone');
    expect(createIssueCalls[2][4]).toBe('low');
  });

  it('should handle mixed regular issues and subissues', async () => {
    const args = {
      project_identifier: 'TEST',
      defaults: {
        component: 'Default',
        milestone: 'Sprint 1',
      },
      issues: [
        {
          title: 'Parent Issue',
          description: 'Parent description',
        },
        {
          parent_issue: 'TEST-99',
          title: 'Child Issue',
          description: 'Child description',
          component: 'Child Component',
        },
      ],
    };

    await handler(args, mockContext);

    expect(createIssueCalls).toHaveLength(1);
    expect(createSubissueCalls).toHaveLength(1);

    // Parent issue uses defaults
    expect(createIssueCalls[0][5]).toBe('Default');
    expect(createIssueCalls[0][6]).toBe('Sprint 1');

    // Child issue overrides component but uses default milestone
    expect(createSubissueCalls[0][5]).toBe('Child Component');
    expect(createSubissueCalls[0][6]).toBe('Sprint 1');
  });
});
