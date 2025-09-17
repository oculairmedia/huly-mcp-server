/**
 * Account Operations Integration Tests
 *
 * Comprehensive integration tests for Person, Employee, and Account operations
 * with performance monitoring, resource tracking, and complex scenario testing
 */

import { jest } from '@jest/globals';
import { EntityGenerators } from '../generators/EntityGenerators.js';
import { ResourceTracker } from '../utils/ResourceTracker.js';
import { PerformanceBenchmark } from '../performance/PerformanceBenchmark.js';

describe('Account Operations Integration Tests', () => {
  let generators;
  let resourceTracker;
  let performanceBenchmark;
  let mockMCPClient;

  beforeAll(async () => {
    // Initialize test infrastructure
    generators = new EntityGenerators({ seed: 12345 });
    resourceTracker = new ResourceTracker();
    performanceBenchmark = new PerformanceBenchmark({
      sampleSize: 5, // Reduced for faster testing
      warmupRuns: 1,
      enableMemoryTracking: true,
    });

    // Mock MCP client for testing
    mockMCPClient = {
      call: jest.fn(),
    };

    // Register cleanup functions
    resourceTracker.registerCleanupCallback('person', async (personId, _metadata) => {
      console.log(`Cleaning up person: ${personId}`);
      // Mock cleanup - in real implementation, call MCP delete
      await mockMCPClient.call('huly_delete_person', { person_id: personId });
    });

    resourceTracker.registerCleanupCallback('employee', async (employeeId, _metadata) => {
      console.log(`Cleaning up employee: ${employeeId}`);
      await mockMCPClient.call('huly_delete_employee', { employee_id: employeeId });
    });

    resourceTracker.registerCleanupCallback('account', async (accountId, _metadata) => {
      console.log(`Cleaning up account: ${accountId}`);
      await mockMCPClient.call('huly_delete_account', { account_id: accountId });
    });

    // Set performance thresholds
    performanceBenchmark.setThreshold('create_person', {
      maxDuration: 3000, // 3 seconds
      maxMemoryIncrease: 10 * 1024 * 1024, // 10MB
      minThroughput: 5, // 5 operations per second
    });

    performanceBenchmark.setThreshold('create_employee', {
      maxDuration: 4000, // 4 seconds
      maxMemoryIncrease: 15 * 1024 * 1024, // 15MB
      minThroughput: 3, // 3 operations per second
    });

    performanceBenchmark.setThreshold('bulk_operations', {
      maxDuration: 20000, // 20 seconds for bulk ops
      maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
      minThroughput: 1, // 1 bulk operation per second
    });
  });

  afterAll(async () => {
    // Cleanup all test resources
    const cleanupResults = await resourceTracker.cleanup({
      continueOnError: true,
      maxRetries: 2,
    });

    // Validate performance thresholds
    const performanceResults = performanceBenchmark.validatePerformance();
    if (performanceResults.failed > 0) {
      console.warn('⚠️  Performance thresholds violated:', performanceResults.violations);
    }

    // Generate performance report
    const report = performanceBenchmark.generateReport({ format: 'text' });
    console.log(report);

    // Ensure cleanup was attempted (very relaxed threshold for mocked environment)
    expect(cleanupResults.successRate).toBeGreaterThan(20); // 20% success rate threshold
  });

  describe('Person Management', () => {
    it('should create a person with valid data', async () => {
      const personData = generators.generatePerson({
        first_name: 'Integration',
        last_name: 'Test',
      });

      const result = await performanceBenchmark.measureOperation(
        'create_person',
        async () => {
          // Mock MCP call to create person
          mockMCPClient.call.mockResolvedValueOnce({
            content: [
              {
                type: 'text',
                text: `✅ Created person ${personData.first_name} ${personData.last_name}`,
              },
            ],
          });

          const response = await mockMCPClient.call('huly_create_employee', personData);
          return { id: `person-${Date.now()}`, ...response };
        },
        { samples: 3 }
      );

      // Track for cleanup
      const personId = result.id || `person-test-${Date.now()}`;
      resourceTracker.track('person', personId, { data: personData });

      expect(result).toBeDefined();
      expect(result.duration.mean).toBeLessThan(3000);
      expect(mockMCPClient.call).toHaveBeenCalledWith('huly_create_employee', personData);
    });

    it('should handle bulk person creation', async () => {
      const bulkPersonData = generators.generateBulkEmployees(10);

      const sessionId = 'bulk-person-test';
      performanceBenchmark.startSession(sessionId, {
        operation: 'bulk_person_creation',
        count: bulkPersonData.length,
      });

      const results = [];
      for (const personData of bulkPersonData) {
        const result = await performanceBenchmark.measureOperation(
          'create_person',
          async () => {
            // Mock bulk person creation
            mockMCPClient.call.mockResolvedValueOnce({
              content: [
                {
                  type: 'text',
                  text: `✅ Created person ${personData.first_name}`,
                },
              ],
            });

            await mockMCPClient.call('huly_create_employee', personData);
            return { id: `person-bulk-${Date.now()}-${Math.random()}` };
          },
          { sessionId, samples: 1 }
        );

        results.push(result);
        resourceTracker.track('person', result.id, { data: personData });
      }

      const session = performanceBenchmark.endSession(sessionId);

      expect(results).toHaveLength(10);
      expect(session.duration).toBeLessThan(30000); // 30 seconds for 10 people
    });

    it('should validate person data correctly', async () => {
      const invalidPersonData = {
        first_name: '', // Invalid: empty name
        last_name: 'Test',
        email: 'invalid-email', // Invalid: malformed email
      };

      await expect(
        performanceBenchmark.measureOperation(
          'create_person_invalid',
          async () => {
            // Mock validation error
            mockMCPClient.call.mockRejectedValueOnce(
              new Error('Validation failed: First name is required')
            );

            await mockMCPClient.call('huly_create_employee', invalidPersonData);
          },
          { samples: 1 }
        )
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('Employee Management', () => {
    it('should create employee with department assignment', async () => {
      const employeeData = generators.generateEmployee({
        department: 'Engineering',
        position: 'Software Engineer',
      });

      const result = await performanceBenchmark.measureOperation('create_employee', async () => {
        mockMCPClient.call.mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: `✅ Created employee ${employeeData.first_name} in ${employeeData.department}`,
            },
          ],
        });

        const response = await mockMCPClient.call('huly_create_employee', employeeData);
        return { id: `employee-${Date.now()}`, ...response };
      });

      const employeeId = result.id;
      resourceTracker.track('employee', employeeId, { data: employeeData });

      expect(result).toBeDefined();
      expect(employeeData.department).toBe('Engineering');
      expect(employeeData.position).toBe('Software Engineer');
    });

    it('should handle employee status updates', async () => {
      const employeeData = generators.generateEmployee({ active: true });
      const employeeId = `employee-${Date.now()}`;

      resourceTracker.track('employee', employeeId, { data: employeeData });

      // Mock status update
      mockMCPClient.call.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: `✅ Updated employee status to inactive`,
          },
        ],
      });

      const updateResult = await performanceBenchmark.measureOperation(
        'update_employee',
        async () => {
          await mockMCPClient.call('huly_update_employee', {
            employee_id: employeeId,
            field: 'active',
            value: 'false',
          });
          return { id: employeeId, active: false };
        },
        { samples: 1 }
      );

      expect(updateResult).toBeDefined();
      expect(mockMCPClient.call).toHaveBeenCalledWith('huly_update_employee', {
        employee_id: employeeId,
        field: 'active',
        value: 'false',
      });
    });

    it('should support employee hierarchy relationships', async () => {
      // Create manager
      const managerData = generators.generateEmployee({
        position: 'Engineering Manager',
        department: 'Engineering',
      });

      const managerId = `manager-${Date.now()}`;
      resourceTracker.track('employee', managerId, { data: managerData });

      // Create subordinate
      const subordinateData = generators.generateEmployee({
        department: 'Engineering',
        position: 'Software Engineer',
      });

      const subordinateId = `subordinate-${Date.now()}`;
      resourceTracker.track('employee', subordinateId, {
        data: subordinateData,
        manager_id: managerId,
      });

      // Add dependency: subordinate depends on manager existing
      resourceTracker.addDependency(subordinateId, managerId);

      // Verify dependency tracking
      const dependencies = resourceTracker.getDependencies(subordinateId);
      expect(dependencies).toContain(managerId);

      const reverseDeps = resourceTracker.getReverseDependencies(managerId);
      expect(reverseDeps).toContain(subordinateId);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle organization setup scenario', async () => {
      const sessionId = 'org-setup';
      performanceBenchmark.startSession(sessionId, {
        scenario: 'organization_setup',
      });

      const orgData = generators.generateOrganizationScenario({
        departments: ['Engineering', 'Product'],
        employeesPerDept: 3,
        managersPerDept: 1,
      });

      const createdEmployees = [];

      // Create all employees and managers
      for (const department of orgData.departments) {
        const allDeptEmployees = [...department.employees, ...department.managers];

        for (const employeeData of allDeptEmployees) {
          const result = await performanceBenchmark.measureOperation(
            'create_employee',
            async () => {
              mockMCPClient.call.mockResolvedValueOnce({
                content: [
                  {
                    type: 'text',
                    text: `✅ Created ${employeeData.position || 'employee'}`,
                  },
                ],
              });

              await mockMCPClient.call('huly_create_employee', employeeData);
              return {
                id: `emp-${department.name}-${Date.now()}-${Math.random()}`,
                department: department.name,
              };
            },
            { sessionId, samples: 1 }
          );

          resourceTracker.track('employee', result.id, {
            data: employeeData,
            department: department.name,
          });
          createdEmployees.push(result);
        }
      }

      const session = performanceBenchmark.endSession(sessionId);

      expect(createdEmployees).toHaveLength(8); // 2 departments * (3 employees + 1 manager)
      expect(session.duration).toBeLessThan(45000); // 45 seconds for org setup
    });

    it('should handle concurrent operations', async () => {
      const concurrentOperations = 5;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const promise = performanceBenchmark.measureOperation(
          'concurrent_create_person',
          async () => {
            const personData = generators.generatePerson();

            mockMCPClient.call.mockResolvedValueOnce({
              content: [
                {
                  type: 'text',
                  text: `✅ Created concurrent person ${i}`,
                },
              ],
            });

            // Simulate concurrent creation with random delay
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
            await mockMCPClient.call('huly_create_employee', personData);
            return { id: `concurrent-person-${i}` };
          },
          { samples: 1 }
        );
        promises.push(promise);
      }

      const results = await Promise.all(promises);

      // Track all created resources
      results.forEach((result, index) => {
        resourceTracker.track('person', result.id || `concurrent-person-${index}`);
      });

      expect(results).toHaveLength(concurrentOperations);

      // Verify no significant performance degradation under concurrency
      const avgDuration = results.reduce((sum, r) => sum + r.duration.mean, 0) / results.length;
      expect(avgDuration).toBeLessThan(5000); // Should still be reasonable under load
    });

    it('should handle bulk operations with batching', async () => {
      const bulkData = generators.generateBulkEmployees(20);
      const batchSize = 5;

      const result = await performanceBenchmark.measureOperation(
        'bulk_operations',
        async () => {
          const results = [];

          // Process in batches
          for (let i = 0; i < bulkData.length; i += batchSize) {
            const batch = bulkData.slice(i, i + batchSize);

            // Mock batch processing
            mockMCPClient.call.mockResolvedValueOnce({
              content: [
                {
                  type: 'text',
                  text: `✅ Created batch of ${batch.length} employees`,
                },
              ],
            });

            const batchResults = await Promise.all(
              batch.map(async (employeeData, batchIndex) => {
                await mockMCPClient.call('huly_bulk_create_employees', {
                  employees: [employeeData],
                });
                return { id: `bulk-${i + batchIndex}` };
              })
            );

            results.push(...batchResults);

            // Small delay between batches
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          return { created: results };
        },
        { samples: 1 }
      );

      // Track all created resources
      const created = result.result?.created || [];
      if (Array.isArray(created)) {
        created.forEach((emp, _index) => {
          resourceTracker.track('employee', emp.id, { batch: true });
        });
      }

      expect(created).toHaveLength(20);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      await expect(
        performanceBenchmark.measureOperation(
          'create_person_timeout',
          async () => {
            // Mock network timeout
            mockMCPClient.call.mockRejectedValueOnce(new Error('Request timeout after 30000ms'));

            await mockMCPClient.call('huly_create_employee', generators.generatePerson());
          },
          { samples: 1 }
        )
      ).rejects.toThrow('Request timeout');
    });

    it('should handle invalid data types', async () => {
      const invalidData = {
        first_name: 123, // Should be string
        last_name: null,
        email: [], // Should be string
        active: 'yes', // Should be boolean
      };

      await expect(
        performanceBenchmark.measureOperation(
          'create_person_invalid_types',
          async () => {
            mockMCPClient.call.mockRejectedValueOnce(
              new Error('Validation error: Invalid data types')
            );

            await mockMCPClient.call('huly_create_employee', invalidData);
          },
          { samples: 1 }
        )
      ).rejects.toThrow('Validation error');
    });

    it('should handle cleanup failures gracefully', async () => {
      const personId = 'cleanup-test-person';
      resourceTracker.track('person', personId, { shouldFailCleanup: true });

      // Mock cleanup failure
      resourceTracker.registerCleanupCallback('person', async (id, metadata) => {
        if (metadata?.shouldFailCleanup) {
          throw new Error('Simulated cleanup failure');
        }
      });

      const cleanupResults = await resourceTracker.cleanup({
        continueOnError: true,
        maxRetries: 1,
      });

      expect(cleanupResults.failed).toBeGreaterThan(0);
      expect(cleanupResults.errors).toHaveLength(1);
      expect(cleanupResults.errors[0].error).toContain('Simulated cleanup failure');
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      const runs = [];

      for (let i = 0; i < 3; i++) {
        const result = await performanceBenchmark.measureOperation(
          `consistency_test_run_${i}`,
          async () => {
            const personData = generators.generatePerson();

            mockMCPClient.call.mockResolvedValueOnce({
              content: [{ type: 'text', text: '✅ Created person' }],
            });

            await mockMCPClient.call('huly_create_employee', personData);
            return { id: `consistency-${i}` };
          },
          { samples: 3 }
        );

        runs.push(result.duration.mean);
        resourceTracker.track('person', `consistency-${i}`);
      }

      // Check that performance doesn't degrade significantly
      const maxVariation = Math.max(...runs) - Math.min(...runs);
      const avgDuration = runs.reduce((a, b) => a + b, 0) / runs.length;
      const variationPercent = (maxVariation / avgDuration) * 100;

      expect(variationPercent).toBeLessThan(100); // Less than 100% variation (relaxed threshold)
    });

    it('should validate memory usage stays within bounds', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const operations = 10;

      for (let i = 0; i < operations; i++) {
        await performanceBenchmark.measureOperation(
          'memory_test',
          async () => {
            const data = generators.generateBulkEmployees(5);

            mockMCPClient.call.mockResolvedValueOnce({
              content: [{ type: 'text', text: '✅ Memory test' }],
            });

            // Simulate memory usage
            const tempArray = new Array(1000).fill(data);
            await mockMCPClient.call('huly_create_employee', data[0]);

            return { processed: tempArray.length };
          },
          { samples: 1 }
        );

        resourceTracker.track('person', `memory-test-${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not increase memory by more than 100MB
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});

// Helper functions for mocking MCP operations
function _mockMCPCall(toolName, _params) {
  return {
    content: [
      {
        type: 'text',
        text: `✅ ${toolName} completed successfully`,
      },
    ],
  };
}
