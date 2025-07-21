/**
 * Integration Test Scenarios
 * Comprehensive test cases for MCP tools
 */

export const testScenarios = {
  // Boundary Testing
  boundary: {
    // Test maximum lengths
    maxTitleLength: {
      name: 'Maximum title length',
      test: async (callTool) => {
        const longTitle = 'A'.repeat(255);
        return callTool('huly_create_issue', {
          project_identifier: 'HULLY',
          title: longTitle,
          priority: 'low',
        });
      },
    },

    // Test empty/null values
    emptyDescription: {
      name: 'Empty description handling',
      test: async (callTool) => {
        return callTool('huly_create_issue', {
          project_identifier: 'HULLY',
          title: 'Issue with empty description',
          description: '',
          priority: 'low',
        });
      },
    },

    // Test special characters
    specialCharacters: {
      name: 'Special characters in title',
      test: async (callTool) => {
        return callTool('huly_create_issue', {
          project_identifier: 'HULLY',
          title: 'Test: Issue with "special" <characters> & symbols!',
          description: 'Testing & < > " \' characters',
          priority: 'low',
        });
      },
    },
  },

  // Error Scenarios
  errors: {
    // Non-existent project
    invalidProject: {
      name: 'Non-existent project',
      expectError: true,
      test: async (callTool) => {
        return callTool('huly_create_issue', {
          project_identifier: 'NONEXISTENT',
          title: 'This should fail',
          priority: 'high',
        });
      },
    },

    // Invalid priority
    invalidPriority: {
      name: 'Invalid priority value',
      expectError: true,
      test: async (callTool) => {
        return callTool('huly_create_issue', {
          project_identifier: 'HULLY',
          title: 'Invalid priority test',
          priority: 'super-urgent',
        });
      },
    },

    // Invalid date format
    invalidDateFormat: {
      name: 'Invalid milestone date format',
      expectError: true,
      test: async (callTool) => {
        return callTool('huly_create_milestone', {
          project_identifier: 'HULLY',
          label: 'Bad Date Milestone',
          target_date: '31/12/2025',
        });
      },
    },
  },

  // Workflow Testing
  workflows: {
    // Complete issue lifecycle
    issueLifecycle: {
      name: 'Complete issue lifecycle',
      test: async (callTool) => {
        const results = {};

        // Create issue
        const createResult = await callTool('huly_create_issue', {
          project_identifier: 'HULLY',
          title: 'Lifecycle Test Issue',
          description: 'Testing complete lifecycle',
          priority: 'high',
        });

        const issueId = createResult.content[0].text.match(/HULLY-(\d+)/)[0];
        results.created = issueId;

        // Update status through workflow
        const statuses = ['todo', 'in-progress', 'done'];
        for (const status of statuses) {
          results[status] = await callTool('huly_update_issue', {
            issue_identifier: issueId,
            field: 'status',
            value: status,
          });
        }

        return results;
      },
    },

    // Parent-child relationships
    issueHierarchy: {
      name: 'Issue hierarchy creation',
      test: async (callTool) => {
        // Create parent
        const parentResult = await callTool('huly_create_issue', {
          project_identifier: 'HULLY',
          title: 'Parent Issue',
          priority: 'high',
        });

        const parentId = parentResult.content[0].text.match(/HULLY-(\d+)/)[0];

        // Create multiple children
        const children = [];
        for (let i = 1; i <= 3; i++) {
          const child = await callTool('huly_create_subissue', {
            parent_issue_identifier: parentId,
            title: `Child Issue ${i}`,
            priority: 'medium',
          });
          children.push(child);
        }

        return { parent: parentId, children };
      },
    },
  },

  // Concurrency Testing
  concurrency: {
    // Parallel issue creation
    parallelCreation: {
      name: 'Parallel issue creation',
      test: async (callTool) => {
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            callTool('huly_create_issue', {
              project_identifier: 'HULLY',
              title: `Concurrent Issue ${i}`,
              priority: 'low',
            })
          );
        }
        return Promise.all(promises);
      },
    },
  },

  // Data Validation
  validation: {
    // Verify data persistence
    dataPersistence: {
      name: 'Data persistence check',
      test: async (callTool) => {
        // Create issue with specific data
        const testData = {
          title: 'Persistence Test Issue',
          description:
            'This description should persist exactly as written\nWith newlines\nAnd special chars: é ñ ü',
          priority: 'high',
        };

        const createResult = await callTool('huly_create_issue', {
          project_identifier: 'HULLY',
          ...testData,
        });

        const issueId = createResult.content[0].text.match(/HULLY-(\d+)/)[0];

        // Get issue details and verify
        const details = await callTool('huly_get_issue_details', {
          issue_identifier: issueId,
        });

        return {
          created: testData,
          retrieved: details,
          matches: details.content[0].text.includes(testData.description),
        };
      },
    },
  },

  // Performance Testing
  performance: {
    // Large result sets
    largeListing: {
      name: 'Large issue listing',
      test: async (callTool) => {
        const start = Date.now();
        const result = await callTool('huly_list_issues', {
          project_identifier: 'HULLY',
          limit: 100,
        });
        const duration = Date.now() - start;

        return {
          duration,
          count: result.content[0].text.match(/Found (\d+) issues/)[1],
          acceptable: duration < 5000, // Should complete in under 5 seconds
        };
      },
    },
  },
};
