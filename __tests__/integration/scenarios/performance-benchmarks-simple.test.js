/**
 * Simplified Performance Benchmarks Integration Tests
 *
 * This test suite focuses on core performance validation with reduced complexity
 * and faster execution times for CI/CD environments.
 */

import { jest } from '@jest/globals';
import { EntityGenerators } from '../generators/EntityGenerators.js';
import { PerformanceBenchmark } from '../performance/PerformanceBenchmark.js';
import { ResourceTracker } from '../utils/ResourceTracker.js';

describe('Performance Benchmarks - Simple', () => {
  let generators;
  let benchmark;
  let resourceTracker;
  let mockMCPClient;

  beforeAll(() => {
    // Initialize test infrastructure
    generators = new EntityGenerators();

    benchmark = new PerformanceBenchmark({
      enableMemoryTracking: true,
      thresholds: {
        person_operations: { maxDuration: 1000, maxMemoryDelta: 10000000 },
        issue_operations: { maxDuration: 2000, maxMemoryDelta: 15000000 },
        bulk_operations: { maxDuration: 5000, maxMemoryDelta: 50000000 },
      },
    });

    resourceTracker = new ResourceTracker();

    // Create mock MCP client
    mockMCPClient = {
      call: jest.fn(),
      request: jest.fn(),
      notification: jest.fn(),
    };
  });

  afterEach(async () => {
    // Clean up resources after each test
    const cleanupResults = await resourceTracker.cleanup({
      batchSize: 10,
      maxRetries: 2,
    });

    console.log(`Cleanup: ${cleanupResults.successful}/${cleanupResults.total} successful`);
  });

  describe('Basic Performance Validation', () => {
    it('should benchmark person creation within thresholds', async () => {
      const result = await benchmark.measureOperation(
        'person_operations',
        async () => {
          const personData = generators.generatePerson();

          // Mock person creation
          mockMCPClient.call.mockResolvedValueOnce({
            content: [{ type: 'text', text: '✅ Created person with ID: test-person-1' }],
          });

          await mockMCPClient.call('huly_create_person', personData);
          return { id: 'test-person-1', ...personData };
        },
        { samples: 3 }
      );

      resourceTracker.track('person', 'test-person-1');

      expect(result.successful).toBe(3);
      expect(result.duration.mean).toBeLessThan(1000);
      expect(result.failed).toBe(0);
    }, 15000);

    it('should benchmark issue operations efficiently', async () => {
      const result = await benchmark.measureOperation(
        'issue_operations',
        async () => {
          const issueData = generators.generateIssue('TEST');

          // Mock issue creation with processing delay
          mockMCPClient.call.mockResolvedValueOnce({
            content: [{ type: 'text', text: '✅ Created issue TEST-1' }],
          });

          await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate processing
          await mockMCPClient.call('huly_create_issue', issueData);
          return { id: 'TEST-1', ...issueData };
        },
        { samples: 3 }
      );

      resourceTracker.track('issue', 'TEST-1');

      expect(result.successful).toBe(3);
      expect(result.duration.mean).toBeLessThan(2000);
      expect(result.failed).toBe(0);
    }, 15000);

    it('should handle bulk operations within reasonable time limits', async () => {
      const result = await benchmark.measureOperation(
        'bulk_operations',
        async () => {
          const bulkData = Array.from({ length: 10 }, (_, i) =>
            generators.generatePerson({ email: `bulk-${i}@test.com` })
          );

          // Mock bulk processing
          mockMCPClient.call.mockResolvedValueOnce({
            content: [{ type: 'text', text: `✅ Created batch of ${bulkData.length} people` }],
          });

          // Simulate batch processing with delay
          await new Promise((resolve) => setTimeout(resolve, 200));
          await mockMCPClient.call('huly_bulk_create_employees', { employees: bulkData });

          return {
            created: bulkData.map((_, i) => ({ id: `bulk-person-${i}` })),
          };
        },
        { samples: 2 }
      );

      // Track bulk created resources
      const created = result.result?.created || [];
      created.forEach((person, i) => {
        resourceTracker.track('person', `bulk-person-${i}`);
      });

      expect(result.successful).toBe(2);
      expect(result.duration.mean).toBeLessThan(5000);
      expect(created).toHaveLength(10);
    }, 20000);
  });

  describe('Memory Usage Validation', () => {
    it('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const operations = 5;

      for (let i = 0; i < operations; i++) {
        await benchmark.measureOperation(
          `memory_test_${i}`,
          async () => {
            const data = generators.generatePerson();
            mockMCPClient.call.mockResolvedValueOnce({
              content: [{ type: 'text', text: `✅ Person ${i}` }],
            });
            await mockMCPClient.call('huly_create_person', data);
            return { id: `memory-test-${i}` };
          },
          { samples: 1 }
        );

        resourceTracker.track('person', `memory-test-${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not increase memory by more than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 15000);
  });

  describe('Performance Report Generation', () => {
    it('should generate comprehensive performance report', async () => {
      // Run a few operations to populate data
      await benchmark.measureOperation(
        'report_test',
        async () => {
          mockMCPClient.call.mockResolvedValueOnce({
            content: [{ type: 'text', text: '✅ Report test operation' }],
          });
          await mockMCPClient.call('huly_create_person', generators.generatePerson());
          return { success: true };
        },
        { samples: 2 }
      );

      const report = benchmark.generateReport({ format: 'text' });

      expect(report).toContain('PERFORMANCE REPORT');
      expect(report).toContain('report_test');
      expect(report.length).toBeGreaterThan(100);
    });

    it('should validate performance thresholds', async () => {
      const result = await benchmark.measureOperation(
        'person_operations',
        async () => {
          mockMCPClient.call.mockResolvedValueOnce({
            content: [{ type: 'text', text: '✅ Threshold test' }],
          });
          await mockMCPClient.call('huly_create_person', generators.generatePerson());
          return { success: true };
        },
        { samples: 1 }
      );

      const results = benchmark.validatePerformance();

      // Should meet our defined thresholds
      expect(results.violations.length).toBe(0);
      expect(result.duration.mean).toBeLessThan(1000);
    });
  });
});
