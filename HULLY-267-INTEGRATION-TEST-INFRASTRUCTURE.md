# HULLY-267: Create Integration Test Infrastructure

## Overview

This document provides a comprehensive implementation guide for creating robust integration test infrastructure for the Huly MCP Server. The infrastructure will support test data generation, resource cleanup, performance benchmarking, and reliable test execution across different environments.

## Current State Analysis

### Existing Infrastructure ✅
- **Jest Configuration**: Both unit (`jest.config.mjs`) and integration (`jest.config.integration.mjs`) configs
- **Test Scripts**: Comprehensive npm scripts for different test scenarios
- **Basic Setup**: Integration test setup in `__tests__/integration/setup.js`
- **Test Data Manager**: Basic implementation in `scripts/test-data-manager.js`
- **Test Reporter**: Advanced reporting in `scripts/test-reporter.js`
- **Test Scenarios**: Comprehensive scenarios in `scripts/test-scenarios.js`
- **CI/CD Integration**: GitHub Actions workflow for automated testing
- **Performance Monitoring**: WizardPerformance.js with metrics collection

### Gaps to Address 🔧
- **Enhanced Test Data Generators**: Need generators for Person, Employee, Account entities
- **Resource Tracking System**: Improve cleanup utilities for complex scenarios
- **Mock Huly Instance**: Setup for isolated testing
- **Performance Benchmarking**: Standardized performance measurement tools
- **Test Fixtures**: Complex scenario fixtures for edge cases

## Implementation Plan

### Phase 1: Enhanced Test Data Generators

#### 1.1 Person/Employee/Account Generators
Create comprehensive generators for new entities:

```javascript
// Location: __tests__/integration/generators/entityGenerators.js
export class EntityGenerators {
  generatePerson(overrides = {}) {
    return {
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      city: faker.location.city(),
      country: faker.location.country(),
      ...overrides
    };
  }

  generateEmployee(overrides = {}) {
    const person = this.generatePerson();
    return {
      ...person,
      position: faker.person.jobTitle(),
      department: faker.commerce.department(),
      active: true,
      ...overrides
    };
  }

  generateAccount(overrides = {}) {
    return {
      email: faker.internet.email(),
      password: faker.internet.password(),
      workspace: `test-${faker.string.alphanumeric(8)}`,
      ...overrides
    };
  }
}
```

#### 1.2 Complex Scenario Generators
```javascript
// Generate complete project hierarchies
generateProjectHierarchy(depth = 3, breadth = 5) {
  // Creates project with components, milestones, issues, and sub-issues
}

// Generate bulk operation test data
generateBulkTestData(entityType, count, options = {}) {
  // Creates large datasets for bulk operation testing
}
```

### Phase 2: Advanced Resource Tracking System

#### 2.1 Enhanced Resource Tracker
```javascript
// Location: __tests__/integration/utils/ResourceTracker.js
export class ResourceTracker {
  constructor() {
    this.resources = new Map();
    this.dependencies = new Map();
    this.cleanupOrder = [];
  }

  track(type, id, metadata = {}) {
    // Track with dependency relationships
  }

  addDependency(parentType, parentId, childType, childId) {
    // Track parent-child relationships for proper cleanup order
  }

  async cleanup(options = {}) {
    // Intelligent cleanup respecting dependencies
  }
}
```

#### 2.2 Cleanup Utilities
```javascript
// Automatic cleanup with retry logic
async cleanupWithRetry(resourceId, type, maxRetries = 3) {
  // Implements exponential backoff for cleanup operations
}

// Batch cleanup for performance
async batchCleanup(resources, batchSize = 10) {
  // Processes cleanup in batches to avoid overwhelming the system
}
```

### Phase 3: Mock Huly Instance Setup

#### 3.1 Test Environment Isolation
```javascript
// Location: __tests__/integration/mocks/HulyMockInstance.js
export class HulyMockInstance {
  constructor(config) {
    this.workspace = config.testWorkspace;
    this.isolatedData = new Map();
  }

  async setup() {
    // Initialize isolated test workspace
  }

  async teardown() {
    // Clean up test workspace
  }
}
```

#### 3.2 Test Data Isolation
- Dedicated test workspace creation
- Isolated test data containers
- Automatic cleanup on test completion

### Phase 4: Performance Benchmarking Tools

#### 4.1 Performance Measurement Framework
```javascript
// Location: __tests__/integration/performance/PerformanceBenchmark.js
export class PerformanceBenchmark {
  constructor() {
    this.metrics = new Map();
    this.thresholds = new Map();
  }

  async measureOperation(name, operation, options = {}) {
    const start = process.hrtime.bigint();
    const result = await operation();
    const end = process.hrtime.bigint();
    
    const duration = Number(end - start) / 1000000; // Convert to ms
    this.recordMetric(name, duration, options);
    
    return result;
  }

  setThreshold(operation, maxDuration) {
    this.thresholds.set(operation, maxDuration);
  }

  validatePerformance() {
    // Check all metrics against thresholds
  }
}
```

#### 4.2 Standardized Performance Tests
```javascript
// Performance test suite for all major operations
const performanceTests = {
  'issue_creation': { threshold: 3000, samples: 10 },
  'bulk_operations': { threshold: 10000, samples: 5 },
  'search_operations': { threshold: 5000, samples: 10 },
  'list_operations': { threshold: 2000, samples: 10 }
};
```

### Phase 5: Test Fixtures for Complex Scenarios

#### 5.1 Fixture Management System
```javascript
// Location: __tests__/integration/fixtures/FixtureManager.js
export class FixtureManager {
  constructor() {
    this.fixtures = new Map();
    this.loadedFixtures = new Set();
  }

  async loadFixture(name, options = {}) {
    // Load and setup complex test scenarios
  }

  async unloadFixture(name) {
    // Clean up fixture data
  }
}
```

#### 5.2 Predefined Fixtures
- **Large Project Fixture**: 1000+ issues, 50+ components, 20+ milestones
- **Hierarchy Fixture**: Deep issue hierarchies (5+ levels)
- **Concurrency Fixture**: Multiple users, simultaneous operations
- **Edge Case Fixture**: Special characters, boundary values, error conditions

## File Structure

```
__tests__/integration/
├── fixtures/
│   ├── FixtureManager.js
│   ├── large-project.json
│   ├── hierarchy-scenario.json
│   └── edge-cases.json
├── generators/
│   ├── EntityGenerators.js
│   ├── ScenarioGenerators.js
│   └── BulkDataGenerators.js
├── mocks/
│   ├── HulyMockInstance.js
│   └── MockDataProvider.js
├── performance/
│   ├── PerformanceBenchmark.js
│   ├── MetricsCollector.js
│   └── ThresholdValidator.js
├── utils/
│   ├── ResourceTracker.js
│   ├── CleanupUtilities.js
│   └── TestHelpers.js
└── scenarios/
    ├── account-operations.test.js
    ├── file-operations.test.js
    ├── performance-benchmarks.test.js
    └── complex-workflows.test.js
```

## Implementation Tasks

### Task 1: Enhanced Test Data Generators
- [ ] Create EntityGenerators class with Person/Employee/Account support
- [ ] Implement ScenarioGenerators for complex test cases
- [ ] Add BulkDataGenerators for large-scale testing
- [ ] Integrate with faker.js for realistic test data

### Task 2: Advanced Resource Tracking
- [ ] Implement ResourceTracker with dependency management
- [ ] Create CleanupUtilities with retry logic and batching
- [ ] Add resource lifecycle management
- [ ] Implement cleanup verification

### Task 3: Mock Huly Instance Setup
- [ ] Create HulyMockInstance for test isolation
- [ ] Implement test workspace management
- [ ] Add data isolation mechanisms
- [ ] Create setup/teardown automation

### Task 4: Performance Benchmarking
- [ ] Implement PerformanceBenchmark framework
- [ ] Create MetricsCollector for comprehensive data gathering
- [ ] Add ThresholdValidator for automated performance checks
- [ ] Integrate with existing test reporter

### Task 5: Test Fixtures System
- [ ] Create FixtureManager for complex scenario management
- [ ] Develop predefined fixtures for common scenarios
- [ ] Implement fixture loading/unloading automation
- [ ] Add fixture validation and verification

### Task 6: Integration Tests for New Features
- [ ] Account operations integration tests
- [ ] File operations integration tests
- [ ] Performance benchmark tests
- [ ] Complex workflow tests

## Acceptance Criteria

### ✅ Easy Test Data Creation
- One-line generators for any entity type
- Realistic test data using faker.js
- Customizable data with overrides
- Bulk data generation capabilities

### ✅ Automatic Cleanup
- Dependency-aware cleanup ordering
- Retry logic for failed cleanup operations
- Batch cleanup for performance
- Verification of successful cleanup

### ✅ Performance Metrics Capture
- Standardized performance measurement
- Threshold-based validation
- Historical performance tracking
- Integration with test reporting

### ✅ Reliable and Fast Tests
- Isolated test environments
- Parallel test execution support
- Comprehensive error handling
- Consistent test results

## Dependencies

### Required Packages
```json
{
  "@faker-js/faker": "^8.0.0",
  "performance-now": "^2.1.0",
  "memory-usage": "^0.1.0"
}
```

### Environment Variables
```bash
TEST_WORKSPACE=integration-test-workspace
TEST_ISOLATION=true
TEST_PERFORMANCE_TRACKING=true
TEST_CLEANUP_VERIFICATION=true
```

## Next Steps

1. **Install Dependencies**: Add faker.js and performance monitoring packages
2. **Create Base Classes**: Implement EntityGenerators and ResourceTracker
3. **Setup Test Environment**: Configure isolated test workspace
4. **Implement Performance Framework**: Create benchmarking tools
5. **Add Integration Tests**: Create tests for account and file operations
6. **Validate Implementation**: Run comprehensive test suite

This infrastructure will provide a solid foundation for all future integration tests, ensuring reliable, fast, and maintainable test execution across the Huly MCP Server.

## Detailed Implementation Examples

### Enhanced Test Data Generators Implementation

#### EntityGenerators.js
```javascript
import { faker } from '@faker-js/faker';

export class EntityGenerators {
  constructor(options = {}) {
    this.locale = options.locale || 'en';
    this.seed = options.seed || Date.now();
    faker.seed(this.seed);
  }

  generatePerson(overrides = {}) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      first_name: firstName,
      last_name: lastName,
      middle_name: faker.datatype.boolean() ? faker.person.middleName() : undefined,
      email: faker.internet.email({ firstName, lastName }),
      phone: faker.phone.number(),
      birthday: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }).toISOString().split('T')[0],
      city: faker.location.city(),
      country: faker.location.country(),
      ...overrides
    };
  }

  generateEmployee(overrides = {}) {
    const person = this.generatePerson();
    const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR'];

    return {
      ...person,
      position: faker.person.jobTitle(),
      department: faker.helpers.arrayElement(departments),
      active: faker.datatype.boolean(0.9), // 90% active
      ...overrides
    };
  }

  generateAccount(overrides = {}) {
    return {
      email: faker.internet.email(),
      password: faker.internet.password({ length: 12, memorable: false }),
      workspace: `test-${faker.string.alphanumeric(8).toLowerCase()}`,
      confirmed: faker.datatype.boolean(0.8), // 80% confirmed
      role: faker.helpers.arrayElement(['user', 'admin', 'viewer']),
      ...overrides
    };
  }

  generateProject(overrides = {}) {
    const name = faker.company.name();
    const identifier = name.substring(0, 5).toUpperCase().replace(/[^A-Z]/g, 'X');

    return {
      name,
      identifier,
      description: faker.lorem.paragraph(),
      ...overrides
    };
  }

  generateIssue(projectIdentifier, overrides = {}) {
    const priorities = ['low', 'medium', 'high', 'urgent'];
    const statuses = ['backlog', 'todo', 'in-progress', 'done', 'canceled'];

    return {
      project_identifier: projectIdentifier,
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      description: faker.lorem.paragraphs(2),
      priority: faker.helpers.arrayElement(priorities),
      status: faker.helpers.arrayElement(statuses),
      ...overrides
    };
  }

  generateComponent(projectIdentifier, overrides = {}) {
    const componentTypes = ['Frontend', 'Backend', 'API', 'Database', 'UI/UX', 'Testing'];

    return {
      project_identifier: projectIdentifier,
      label: faker.helpers.arrayElement(componentTypes),
      description: faker.lorem.sentence(),
      ...overrides
    };
  }

  generateMilestone(projectIdentifier, overrides = {}) {
    const futureDate = faker.date.future({ years: 1 });

    return {
      project_identifier: projectIdentifier,
      label: `${faker.lorem.word()} ${faker.date.month()} Release`,
      description: faker.lorem.sentence(),
      target_date: futureDate.toISOString().split('T')[0],
      status: 'planned',
      ...overrides
    };
  }

  // Bulk generation methods
  generateBulkIssues(projectIdentifier, count, overrides = {}) {
    return Array.from({ length: count }, () =>
      this.generateIssue(projectIdentifier, overrides)
    );
  }

  generateBulkEmployees(count, overrides = {}) {
    return Array.from({ length: count }, () =>
      this.generateEmployee(overrides)
    );
  }

  // Complex scenario generators
  generateProjectHierarchy(options = {}) {
    const {
      componentsCount = 5,
      milestonesCount = 3,
      issuesCount = 20,
      subIssuesPerIssue = 2
    } = options;

    const project = this.generateProject();
    const components = Array.from({ length: componentsCount }, () =>
      this.generateComponent(project.identifier)
    );
    const milestones = Array.from({ length: milestonesCount }, () =>
      this.generateMilestone(project.identifier)
    );

    const issues = Array.from({ length: issuesCount }, () => {
      const issue = this.generateIssue(project.identifier);
      // Randomly assign components and milestones
      if (components.length > 0 && faker.datatype.boolean(0.7)) {
        issue.component = faker.helpers.arrayElement(components).label;
      }
      if (milestones.length > 0 && faker.datatype.boolean(0.5)) {
        issue.milestone = faker.helpers.arrayElement(milestones).label;
      }
      return issue;
    });

    // Generate sub-issues for some issues
    const subIssues = [];
    issues.slice(0, Math.floor(issuesCount / 3)).forEach(parentIssue => {
      for (let i = 0; i < subIssuesPerIssue; i++) {
        const subIssue = this.generateIssue(project.identifier);
        subIssue.parent_issue_identifier = `${project.identifier}-${faker.number.int({ min: 1, max: 999 })}`;
        subIssues.push(subIssue);
      }
    });

    return {
      project,
      components,
      milestones,
      issues,
      subIssues
    };
  }
}
```

### Advanced Resource Tracking Implementation

#### ResourceTracker.js
```javascript
export class ResourceTracker {
  constructor() {
    this.resources = new Map(); // resourceId -> { type, metadata, createdAt }
    this.dependencies = new Map(); // parentId -> Set<childId>
    this.reverseDependencies = new Map(); // childId -> Set<parentId>
    this.cleanupOrder = [];
    this.cleanupCallbacks = new Map(); // type -> cleanup function
  }

  // Register cleanup functions for different resource types
  registerCleanupCallback(type, cleanupFn) {
    this.cleanupCallbacks.set(type, cleanupFn);
  }

  // Track a resource with optional metadata
  track(type, id, metadata = {}) {
    this.resources.set(id, {
      type,
      metadata,
      createdAt: new Date(),
      cleanedUp: false
    });

    console.log(`📝 Tracking ${type}: ${id}`);
  }

  // Add dependency relationship (parent depends on child existing)
  addDependency(parentId, childId) {
    if (!this.dependencies.has(parentId)) {
      this.dependencies.set(parentId, new Set());
    }
    if (!this.reverseDependencies.has(childId)) {
      this.reverseDependencies.set(childId, new Set());
    }

    this.dependencies.get(parentId).add(childId);
    this.reverseDependencies.get(childId).add(parentId);

    console.log(`🔗 Added dependency: ${parentId} -> ${childId}`);
  }

  // Calculate cleanup order using topological sort
  calculateCleanupOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (resourceId) => {
      if (visiting.has(resourceId)) {
        throw new Error(`Circular dependency detected involving ${resourceId}`);
      }
      if (visited.has(resourceId)) {
        return;
      }

      visiting.add(resourceId);

      // Visit all dependencies first
      const deps = this.dependencies.get(resourceId) || new Set();
      for (const depId of deps) {
        if (this.resources.has(depId)) {
          visit(depId);
        }
      }

      visiting.delete(resourceId);
      visited.add(resourceId);
      order.push(resourceId);
    };

    // Visit all resources
    for (const resourceId of this.resources.keys()) {
      if (!visited.has(resourceId)) {
        visit(resourceId);
      }
    }

    return order;
  }

  // Cleanup all tracked resources
  async cleanup(options = {}) {
    const {
      dryRun = false,
      maxRetries = 3,
      batchSize = 10,
      continueOnError = true
    } = options;

    console.log('\n🧹 Starting resource cleanup...');

    if (dryRun) {
      console.log('🔍 DRY RUN - No actual cleanup will be performed');
    }

    const cleanupOrder = this.calculateCleanupOrder();
    console.log(`📋 Cleanup order: ${cleanupOrder.length} resources`);

    const results = {
      total: cleanupOrder.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < cleanupOrder.length; i += batchSize) {
      const batch = cleanupOrder.slice(i, i + batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cleanupOrder.length / batchSize)}`);

      const batchPromises = batch.map(async (resourceId) => {
        const resource = this.resources.get(resourceId);
        if (!resource || resource.cleanedUp) {
          return { resourceId, success: true, skipped: true };
        }

        return this.cleanupResource(resourceId, resource, { dryRun, maxRetries });
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { resourceId, success, error, skipped } = result.value;

          if (skipped) {
            console.log(`⏭️  Skipped ${resourceId} (already cleaned up)`);
            continue;
          }

          if (success) {
            results.successful++;
            this.resources.get(resourceId).cleanedUp = true;
            console.log(`✅ Cleaned up ${resourceId}`);
          } else {
            results.failed++;
            results.errors.push({ resourceId, error });
            console.log(`❌ Failed to clean up ${resourceId}: ${error}`);

            if (!continueOnError) {
              throw new Error(`Cleanup failed for ${resourceId}: ${error}`);
            }
          }
        } else {
          results.failed++;
          results.errors.push({ resourceId: 'unknown', error: result.reason.message });
          console.log(`💥 Batch operation failed: ${result.reason.message}`);
        }
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);

    if (results.errors.length > 0) {
      console.log('\n❌ Cleanup Errors:');
      results.errors.forEach(({ resourceId, error }) => {
        console.log(`   ${resourceId}: ${error}`);
      });
    }

    return results;
  }

  // Cleanup a single resource with retry logic
  async cleanupResource(resourceId, resource, options = {}) {
    const { dryRun = false, maxRetries = 3 } = options;
    const { type } = resource;

    if (dryRun) {
      return { resourceId, success: true, dryRun: true };
    }

    const cleanupFn = this.cleanupCallbacks.get(type);
    if (!cleanupFn) {
      return {
        resourceId,
        success: false,
        error: `No cleanup function registered for type: ${type}`
      };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await cleanupFn(resourceId, resource.metadata);
        return { resourceId, success: true };
      } catch (error) {
        console.log(`⚠️  Cleanup attempt ${attempt}/${maxRetries} failed for ${resourceId}: ${error.message}`);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          return { resourceId, success: false, error: error.message };
        }
      }
    }
  }

  // Get cleanup statistics
  getStats() {
    const totalResources = this.resources.size;
    const cleanedUp = Array.from(this.resources.values()).filter(r => r.cleanedUp).length;
    const typeStats = new Map();

    for (const resource of this.resources.values()) {
      const count = typeStats.get(resource.type) || { total: 0, cleanedUp: 0 };
      count.total++;
      if (resource.cleanedUp) count.cleanedUp++;
      typeStats.set(resource.type, count);
    }

    return {
      total: totalResources,
      cleanedUp,
      remaining: totalResources - cleanedUp,
      byType: Object.fromEntries(typeStats)
    };
  }

  // Clear all tracking data
  reset() {
    this.resources.clear();
    this.dependencies.clear();
    this.reverseDependencies.clear();
    this.cleanupOrder = [];
    console.log('🔄 Resource tracker reset');
  }
}
```

### Performance Benchmarking Implementation

#### PerformanceBenchmark.js
```javascript
import { performance } from 'perf_hooks';

export class PerformanceBenchmark {
  constructor(options = {}) {
    this.metrics = new Map(); // operation -> Array<measurement>
    this.thresholds = new Map(); // operation -> threshold config
    this.sessions = new Map(); // sessionId -> session data
    this.options = {
      enableMemoryTracking: options.enableMemoryTracking ?? true,
      enableCPUTracking: options.enableCPUTracking ?? false,
      sampleSize: options.sampleSize ?? 10,
      warmupRuns: options.warmupRuns ?? 2,
      ...options
    };
  }

  // Set performance threshold for an operation
  setThreshold(operation, config) {
    if (typeof config === 'number') {
      config = { maxDuration: config };
    }

    this.thresholds.set(operation, {
      maxDuration: config.maxDuration,
      maxMemoryIncrease: config.maxMemoryIncrease || 50 * 1024 * 1024, // 50MB
      minThroughput: config.minThroughput,
      ...config
    });
  }

  // Start a performance measurement session
  startSession(sessionId, metadata = {}) {
    const session = {
      id: sessionId,
      startTime: performance.now(),
      startMemory: this.options.enableMemoryTracking ? process.memoryUsage() : null,
      operations: [],
      metadata
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  // Measure a single operation
  async measureOperation(name, operation, options = {}) {
    const sessionId = options.sessionId || 'default';
    const samples = options.samples || this.options.sampleSize;
    const warmupRuns = options.warmupRuns ?? this.options.warmupRuns;

    console.log(`🔬 Measuring ${name} (${samples} samples, ${warmupRuns} warmup runs)`);

    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      try {
        await operation();
      } catch (error) {
        console.warn(`Warmup run ${i + 1} failed: ${error.message}`);
      }
    }

    const measurements = [];

    for (let i = 0; i < samples; i++) {
      const measurement = await this.measureSingleRun(name, operation, { sessionId });
      measurements.push(measurement);

      // Small delay between measurements to avoid overwhelming the system
      if (i < samples - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const aggregated = this.aggregateMeasurements(name, measurements);
    this.recordMeasurement(name, aggregated);

    // Add to session if specified
    if (this.sessions.has(sessionId)) {
      this.sessions.get(sessionId).operations.push(aggregated);
    }

    return aggregated;
  }

  // Measure a single run of an operation
  async measureSingleRun(name, operation, options = {}) {
    const startMemory = this.options.enableMemoryTracking ? process.memoryUsage() : null;
    const startTime = performance.now();

    let result, error;
    try {
      result = await operation();
    } catch (err) {
      error = err;
    }

    const endTime = performance.now();
    const endMemory = this.options.enableMemoryTracking ? process.memoryUsage() : null;

    const measurement = {
      name,
      duration: endTime - startTime,
      success: !error,
      error: error?.message,
      timestamp: new Date().toISOString(),
      memory: startMemory && endMemory ? {
        heapUsedDelta: endMemory.heapUsed - startMemory.heapUsed,
        heapTotalDelta: endMemory.heapTotal - startMemory.heapTotal,
        rssDelta: endMemory.rss - startMemory.rss
      } : null
    };

    if (error) {
      throw error;
    }

    return measurement;
  }

  // Aggregate multiple measurements
  aggregateMeasurements(name, measurements) {
    const successful = measurements.filter(m => m.success);
    const durations = successful.map(m => m.duration);

    if (durations.length === 0) {
      throw new Error(`All measurements for ${name} failed`);
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const memoryDeltas = successful
      .filter(m => m.memory)
      .map(m => m.memory.heapUsedDelta);

    return {
      name,
      samples: measurements.length,
      successful: successful.length,
      failed: measurements.length - successful.length,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        mean: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      },
      memory: memoryDeltas.length > 0 ? {
        minDelta: Math.min(...memoryDeltas),
        maxDelta: Math.max(...memoryDeltas),
        meanDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length
      } : null,
      timestamp: new Date().toISOString()
    };
  }

  // Record a measurement
  recordMeasurement(name, measurement) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(measurement);
  }

  // Validate performance against thresholds
  validatePerformance() {
    const results = {
      passed: 0,
      failed: 0,
      violations: []
    };

    for (const [operation, threshold] of this.thresholds) {
      const measurements = this.metrics.get(operation);
      if (!measurements || measurements.length === 0) {
        results.violations.push({
          operation,
          type: 'missing',
          message: `No measurements found for ${operation}`
        });
        results.failed++;
        continue;
      }

      const latest = measurements[measurements.length - 1];
      const violations = this.checkThresholds(operation, latest, threshold);

      if (violations.length > 0) {
        results.violations.push(...violations);
        results.failed++;
      } else {
        results.passed++;
      }
    }

    return results;
  }

  // Check individual thresholds
  checkThresholds(operation, measurement, threshold) {
    const violations = [];

    // Duration threshold
    if (threshold.maxDuration && measurement.duration.p95 > threshold.maxDuration) {
      violations.push({
        operation,
        type: 'duration',
        message: `P95 duration ${measurement.duration.p95.toFixed(2)}ms exceeds threshold ${threshold.maxDuration}ms`,
        actual: measurement.duration.p95,
        threshold: threshold.maxDuration
      });
    }

    // Memory threshold
    if (threshold.maxMemoryIncrease && measurement.memory &&
        measurement.memory.meanDelta > threshold.maxMemoryIncrease) {
      violations.push({
        operation,
        type: 'memory',
        message: `Memory increase ${(measurement.memory.meanDelta / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(threshold.maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB`,
        actual: measurement.memory.meanDelta,
        threshold: threshold.maxMemoryIncrease
      });
    }

    // Throughput threshold (operations per second)
    if (threshold.minThroughput) {
      const throughput = 1000 / measurement.duration.mean; // ops/sec
      if (throughput < threshold.minThroughput) {
        violations.push({
          operation,
          type: 'throughput',
          message: `Throughput ${throughput.toFixed(2)} ops/sec below threshold ${threshold.minThroughput} ops/sec`,
          actual: throughput,
          threshold: threshold.minThroughput
        });
      }
    }

    return violations;
  }

  // End a performance session
  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.endTime = performance.now();
    session.duration = session.endTime - session.startTime;
    session.endMemory = this.options.enableMemoryTracking ? process.memoryUsage() : null;

    return session;
  }

  // Generate performance report
  generateReport(options = {}) {
    const { format = 'text', includeRaw = false } = options;

    const report = {
      summary: this.generateSummary(),
      operations: this.generateOperationReports(),
      thresholds: this.validatePerformance(),
      sessions: Array.from(this.sessions.values()),
      timestamp: new Date().toISOString()
    };

    if (includeRaw) {
      report.rawMetrics = Object.fromEntries(this.metrics);
    }

    if (format === 'text') {
      return this.formatTextReport(report);
    }

    return report;
  }

  // Generate summary statistics
  generateSummary() {
    const totalOperations = this.metrics.size;
    const totalMeasurements = Array.from(this.metrics.values())
      .reduce((sum, measurements) => sum + measurements.length, 0);

    return {
      totalOperations,
      totalMeasurements,
      averageMeasurementsPerOperation: totalMeasurements / totalOperations || 0,
      sessionsCount: this.sessions.size
    };
  }

  // Generate operation-specific reports
  generateOperationReports() {
    const reports = {};

    for (const [operation, measurements] of this.metrics) {
      const latest = measurements[measurements.length - 1];
      const threshold = this.thresholds.get(operation);

      reports[operation] = {
        measurementCount: measurements.length,
        latest,
        threshold,
        trend: this.calculateTrend(measurements),
        status: threshold ? this.checkThresholds(operation, latest, threshold).length === 0 ? 'pass' : 'fail' : 'unknown'
      };
    }

    return reports;
  }

  // Calculate performance trend
  calculateTrend(measurements) {
    if (measurements.length < 2) return 'insufficient_data';

    const recent = measurements.slice(-5); // Last 5 measurements
    const older = measurements.slice(-10, -5); // Previous 5 measurements

    if (older.length === 0) return 'insufficient_data';

    const recentAvg = recent.reduce((sum, m) => sum + m.duration.mean, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.duration.mean, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'degrading' : 'improving';
  }

  // Format text report
  formatTextReport(report) {
    let text = '\n📊 PERFORMANCE REPORT\n';
    text += '='.repeat(50) + '\n\n';

    // Summary
    text += `📈 Summary:\n`;
    text += `   Operations: ${report.summary.totalOperations}\n`;
    text += `   Measurements: ${report.summary.totalMeasurements}\n`;
    text += `   Sessions: ${report.summary.sessionsCount}\n\n`;

    // Threshold validation
    text += `🎯 Threshold Validation:\n`;
    text += `   Passed: ${report.thresholds.passed}\n`;
    text += `   Failed: ${report.thresholds.failed}\n\n`;

    if (report.thresholds.violations.length > 0) {
      text += `❌ Violations:\n`;
      for (const violation of report.thresholds.violations) {
        text += `   ${violation.operation}: ${violation.message}\n`;
      }
      text += '\n';
    }

    // Operation details
    text += `🔍 Operation Details:\n`;
    for (const [operation, details] of Object.entries(report.operations)) {
      const { latest } = details;
      text += `   ${operation}:\n`;
      text += `     Status: ${details.status}\n`;
      text += `     Trend: ${details.trend}\n`;
      text += `     Duration: ${latest.duration.mean.toFixed(2)}ms (±${(latest.duration.max - latest.duration.min).toFixed(2)}ms)\n`;
      text += `     P95: ${latest.duration.p95.toFixed(2)}ms\n`;
      if (latest.memory) {
        text += `     Memory: ${(latest.memory.meanDelta / 1024 / 1024).toFixed(2)}MB avg delta\n`;
      }
      text += '\n';
    }

    return text;
  }

  // Reset all metrics
  reset() {
    this.metrics.clear();
    this.sessions.clear();
  }
}
```

## Practical Test Examples

### Complete Integration Test Example

#### account-operations.test.js
```javascript
import { jest } from '@jest/globals';
import { EntityGenerators } from '../generators/EntityGenerators.js';
import { ResourceTracker } from '../utils/ResourceTracker.js';
import { PerformanceBenchmark } from '../performance/PerformanceBenchmark.js';
import { setupTestEnvironment } from '../setup.js';

describe('Account Operations Integration Tests', () => {
  let generators;
  let resourceTracker;
  let performanceBenchmark;
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment();
    generators = new EntityGenerators({ seed: 12345 });
    resourceTracker = new ResourceTracker();
    performanceBenchmark = new PerformanceBenchmark();

    // Register cleanup functions
    resourceTracker.registerCleanupCallback('account', async (accountId) => {
      // Cleanup account logic here
      console.log(`Cleaning up account: ${accountId}`);
    });

    resourceTracker.registerCleanupCallback('person', async (personId) => {
      // Cleanup person logic here
      console.log(`Cleaning up person: ${personId}`);
    });

    // Set performance thresholds
    performanceBenchmark.setThreshold('create_account', {
      maxDuration: 3000, // 3 seconds
      maxMemoryIncrease: 10 * 1024 * 1024 // 10MB
    });

    performanceBenchmark.setThreshold('create_person', {
      maxDuration: 2000, // 2 seconds
      minThroughput: 5 // 5 operations per second
    });
  });

  afterAll(async () => {
    // Cleanup all test resources
    await resourceTracker.cleanup({ continueOnError: true });

    // Validate performance
    const performanceResults = performanceBenchmark.validatePerformance();
    if (performanceResults.failed > 0) {
      console.warn('⚠️ Performance thresholds violated:', performanceResults.violations);
    }

    // Generate performance report
    const report = performanceBenchmark.generateReport({ format: 'text' });
    console.log(report);
  });

  describe('Person Management', () => {
    it('should create a person with valid data', async () => {
      const personData = generators.generatePerson({
        first_name: 'Integration',
        last_name: 'Test'
      });

      const result = await performanceBenchmark.measureOperation(
        'create_person',
        async () => {
          // Mock MCP call to create person
          const response = await callMCPTool('huly_create_person', personData);
          return response;
        }
      );

      // Track for cleanup
      const personId = 'person-123'; // Extract from response
      resourceTracker.track('person', personId, { data: personData });

      expect(result).toBeDefined();
      expect(result.duration.mean).toBeLessThan(2000);
    });

    it('should handle bulk person creation', async () => {
      const bulkPersonData = generators.generateBulkEmployees(50);

      const sessionId = 'bulk-person-test';
      performanceBenchmark.startSession(sessionId, {
        operation: 'bulk_person_creation',
        count: bulkPersonData.length
      });

      const results = [];
      for (const personData of bulkPersonData) {
        const result = await performanceBenchmark.measureOperation(
          'create_person',
          async () => {
            // Mock bulk creation
            return { id: `person-${Date.now()}-${Math.random()}` };
          },
          { sessionId }
        );

        results.push(result);
        resourceTracker.track('person', result.id, { data: personData });
      }

      const session = performanceBenchmark.endSession(sessionId);

      expect(results).toHaveLength(50);
      expect(session.duration).toBeLessThan(30000); // 30 seconds for 50 people
    });
  });

  describe('Employee Management', () => {
    it('should create employee from person', async () => {
      // First create a person
      const personData = generators.generatePerson();
      const personId = 'person-456';
      resourceTracker.track('person', personId, { data: personData });

      // Then create employee
      const employeeData = generators.generateEmployee({
        first_name: personData.first_name,
        last_name: personData.last_name,
        email: personData.email
      });

      const result = await performanceBenchmark.measureOperation(
        'create_employee',
        async () => {
          // Mock employee creation
          return { id: 'employee-456', person_id: personId };
        }
      );

      const employeeId = result.id;
      resourceTracker.track('employee', employeeId, {
        data: employeeData,
        person_id: personId
      });

      // Add dependency: employee depends on person
      resourceTracker.addDependency(employeeId, personId);

      expect(result).toBeDefined();
    });

    it('should handle employee status updates', async () => {
      const employeeData = generators.generateEmployee({ active: true });
      const employeeId = 'employee-789';

      resourceTracker.track('employee', employeeId, { data: employeeData });

      // Test status update
      const updateResult = await performanceBenchmark.measureOperation(
        'update_employee',
        async () => {
          // Mock status update
          return { id: employeeId, active: false };
        }
      );

      expect(updateResult).toBeDefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle organization setup scenario', async () => {
      const sessionId = 'org-setup';
      performanceBenchmark.startSession(sessionId, {
        scenario: 'organization_setup'
      });

      // Generate organization data
      const orgData = {
        departments: ['Engineering', 'Product', 'Design'],
        employeesPerDept: 10,
        managersPerDept: 2
      };

      const createdEmployees = [];

      for (const department of orgData.departments) {
        // Create department employees
        const employees = generators.generateBulkEmployees(
          orgData.employeesPerDept,
          { department }
        );

        for (const employeeData of employees) {
          const result = await performanceBenchmark.measureOperation(
            'create_employee',
            async () => {
              return {
                id: `emp-${department}-${Date.now()}-${Math.random()}`,
                department
              };
            },
            { sessionId }
          );

          resourceTracker.track('employee', result.id, {
            data: employeeData,
            department
          });
          createdEmployees.push(result);
        }

        // Create managers
        const managers = generators.generateBulkEmployees(
          orgData.managersPerDept,
          {
            department,
            position: `${department} Manager`
          }
        );

        for (const managerData of managers) {
          const result = await performanceBenchmark.measureOperation(
            'create_employee',
            async () => {
              return {
                id: `mgr-${department}-${Date.now()}-${Math.random()}`,
                department,
                role: 'manager'
              };
            },
            { sessionId }
          );

          resourceTracker.track('employee', result.id, {
            data: managerData,
            department,
            role: 'manager'
          });
          createdEmployees.push(result);
        }
      }

      const session = performanceBenchmark.endSession(sessionId);

      expect(createdEmployees).toHaveLength(
        orgData.departments.length * (orgData.employeesPerDept + orgData.managersPerDept)
      );
      expect(session.duration).toBeLessThan(60000); // 1 minute for full org setup
    });

    it('should handle concurrent operations', async () => {
      const concurrentOperations = 10;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const promise = performanceBenchmark.measureOperation(
          'concurrent_create_person',
          async () => {
            const personData = generators.generatePerson();
            // Simulate concurrent creation
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            return { id: `concurrent-person-${i}` };
          }
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
  });

  describe('Error Handling', () => {
    it('should handle invalid data gracefully', async () => {
      const invalidPersonData = {
        first_name: '', // Invalid: empty name
        last_name: 'Test',
        email: 'invalid-email' // Invalid: malformed email
      };

      await expect(
        performanceBenchmark.measureOperation(
          'create_person_invalid',
          async () => {
            // Mock validation error
            throw new Error('Validation failed: Invalid email format');
          }
        )
      ).rejects.toThrow('Validation failed');
    });

    it('should handle network timeouts', async () => {
      await expect(
        performanceBenchmark.measureOperation(
          'create_person_timeout',
          async () => {
            // Simulate timeout
            await new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), 100)
            );
          }
        )
      ).rejects.toThrow('Request timeout');
    });
  });
});

// Helper function to mock MCP tool calls
async function callMCPTool(toolName, params) {
  // Mock implementation - replace with actual MCP client call
  return {
    content: [
      {
        type: 'text',
        text: `✅ ${toolName} completed successfully with params: ${JSON.stringify(params)}`
      }
    ]
  };
}
```

### Performance Benchmark Test Suite

#### performance-benchmarks.test.js
```javascript
import { jest } from '@jest/globals';
import { PerformanceBenchmark } from '../performance/PerformanceBenchmark.js';
import { EntityGenerators } from '../generators/EntityGenerators.js';

describe('Performance Benchmarks', () => {
  let benchmark;
  let generators;

  beforeAll(() => {
    benchmark = new PerformanceBenchmark({
      sampleSize: 20,
      warmupRuns: 3,
      enableMemoryTracking: true
    });

    generators = new EntityGenerators();

    // Set comprehensive thresholds
    benchmark.setThreshold('issue_creation', {
      maxDuration: 3000,
      minThroughput: 10,
      maxMemoryIncrease: 5 * 1024 * 1024
    });

    benchmark.setThreshold('bulk_issue_creation', {
      maxDuration: 15000,
      minThroughput: 2,
      maxMemoryIncrease: 50 * 1024 * 1024
    });

    benchmark.setThreshold('issue_search', {
      maxDuration: 5000,
      minThroughput: 5,
      maxMemoryIncrease: 10 * 1024 * 1024
    });

    benchmark.setThreshold('issue_listing', {
      maxDuration: 2000,
      minThroughput: 15,
      maxMemoryIncrease: 5 * 1024 * 1024
    });
  });

  afterAll(() => {
    const validation = benchmark.validatePerformance();
    const report = benchmark.generateReport({ format: 'text', includeRaw: false });

    console.log(report);

    if (validation.failed > 0) {
      console.error('❌ Performance benchmarks failed:', validation.violations);
      // Don't fail the test, just warn
    }
  });

  it('should benchmark issue creation performance', async () => {
    const result = await benchmark.measureOperation(
      'issue_creation',
      async () => {
        const issueData = generators.generateIssue('PERF');
        // Mock issue creation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        return { id: `PERF-${Date.now()}` };
      },
      { samples: 15 }
    );

    expect(result.successful).toBe(15);
    expect(result.duration.mean).toBeLessThan(3000);
  });

  it('should benchmark bulk issue creation', async () => {
    const result = await benchmark.measureOperation(
      'bulk_issue_creation',
      async () => {
        const issues = generators.generateBulkIssues('PERF', 50);
        // Mock bulk creation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        return { created: issues.length };
      },
      { samples: 5 }
    );

    expect(result.successful).toBe(5);
    expect(result.duration.mean).toBeLessThan(15000);
  });

  it('should benchmark search performance', async () => {
    const result = await benchmark.measureOperation(
      'issue_search',
      async () => {
        // Mock search operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
        return { results: Array(25).fill().map((_, i) => ({ id: `PERF-${i}` })) };
      }
    );

    expect(result.successful).toBeGreaterThan(15);
    expect(result.duration.p95).toBeLessThan(5000);
  });

  it('should benchmark listing performance', async () => {
    const result = await benchmark.measureOperation(
      'issue_listing',
      async () => {
        // Mock listing operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
        return { issues: Array(100).fill().map((_, i) => ({ id: `PERF-${i}` })) };
      }
    );

    expect(result.successful).toBeGreaterThan(15);
    expect(result.duration.mean).toBeLessThan(2000);
  });

  it('should benchmark under load conditions', async () => {
    const sessionId = 'load-test';
    benchmark.startSession(sessionId, { type: 'load_test' });

    // Simulate high load scenario
    const concurrentOperations = 20;
    const promises = [];

    for (let i = 0; i < concurrentOperations; i++) {
      const promise = benchmark.measureOperation(
        'concurrent_issue_creation',
        async () => {
          const issueData = generators.generateIssue('LOAD');
          await new Promise(resolve =>
            setTimeout(resolve, Math.random() * 200 + 100)
          );
          return { id: `LOAD-${i}` };
        },
        { sessionId, samples: 1 }
      );
      promises.push(promise);
    }

    const results = await Promise.all(promises);
    const session = benchmark.endSession(sessionId);

    expect(results).toHaveLength(concurrentOperations);
    expect(session.duration).toBeLessThan(30000); // 30 seconds for all operations

    // Verify system didn't degrade significantly under load
    const avgDuration = results.reduce((sum, r) => sum + r.duration.mean, 0) / results.length;
    expect(avgDuration).toBeLessThan(5000);
  });
});
```

## Quick Start Implementation Guide

### Step 1: Install Dependencies
```bash
npm install --save-dev @faker-js/faker performance-now memory-usage
```

### Step 2: Create Base Infrastructure Files

Create the following files in order:

1. **EntityGenerators.js** - Copy the implementation from above
2. **ResourceTracker.js** - Copy the implementation from above
3. **PerformanceBenchmark.js** - Copy the implementation from above

### Step 3: Update Test Configuration

Add to `package.json`:
```json
{
  "scripts": {
    "test:integration:performance": "NODE_OPTIONS='--experimental-vm-modules' jest --config jest.config.integration.mjs performance-benchmarks.test.js",
    "test:integration:accounts": "NODE_OPTIONS='--experimental-vm-modules' jest --config jest.config.integration.mjs account-operations.test.js",
    "test:integration:comprehensive": "npm run test:integration && npm run test:integration:performance"
  }
}
```

### Step 4: Environment Configuration

Add to `.env.test`:
```bash
# Test Infrastructure Settings
TEST_WORKSPACE=integration-test-workspace
TEST_ISOLATION=true
TEST_PERFORMANCE_TRACKING=true
TEST_CLEANUP_VERIFICATION=true
TEST_FAKER_SEED=12345
TEST_SAMPLE_SIZE=10
TEST_WARMUP_RUNS=2
```

### Step 5: Create Your First Test

```javascript
// __tests__/integration/my-first-enhanced-test.js
import { EntityGenerators } from './generators/EntityGenerators.js';
import { ResourceTracker } from './utils/ResourceTracker.js';
import { PerformanceBenchmark } from './performance/PerformanceBenchmark.js';

describe('My Enhanced Integration Test', () => {
  let generators, tracker, benchmark;

  beforeAll(() => {
    generators = new EntityGenerators();
    tracker = new ResourceTracker();
    benchmark = new PerformanceBenchmark();

    // Set thresholds
    benchmark.setThreshold('my_operation', { maxDuration: 2000 });
  });

  afterAll(async () => {
    await tracker.cleanup();
    console.log(benchmark.generateReport({ format: 'text' }));
  });

  it('should create and track a test entity', async () => {
    const data = generators.generatePerson();

    const result = await benchmark.measureOperation('my_operation', async () => {
      // Your test logic here
      return { id: 'test-123' };
    });

    tracker.track('person', result.id, { data });

    expect(result).toBeDefined();
  });
});
```

## Implementation Checklist

### Phase 1: Foundation ✅
- [ ] Install required dependencies (@faker-js/faker, performance-now, memory-usage)
- [ ] Create `__tests__/integration/generators/EntityGenerators.js`
- [ ] Create `__tests__/integration/utils/ResourceTracker.js`
- [ ] Create `__tests__/integration/performance/PerformanceBenchmark.js`
- [ ] Update test configuration files
- [ ] Add environment variables for test configuration

### Phase 2: Test Data Generators ✅
- [ ] Implement Person generator with realistic data
- [ ] Implement Employee generator with department/role support
- [ ] Implement Account generator with workspace management
- [ ] Implement Project hierarchy generator
- [ ] Add bulk data generation capabilities
- [ ] Test generators with various scenarios

### Phase 3: Resource Management ✅
- [ ] Implement dependency tracking system
- [ ] Add cleanup callbacks for all entity types
- [ ] Implement retry logic for failed cleanup operations
- [ ] Add batch cleanup for performance
- [ ] Test cleanup with complex dependency chains
- [ ] Verify cleanup completion and success rates

### Phase 4: Performance Framework ✅
- [ ] Implement performance measurement with memory tracking
- [ ] Add threshold validation system
- [ ] Create session-based performance tracking
- [ ] Implement statistical analysis (P95, P99, etc.)
- [ ] Add performance trend analysis
- [ ] Create comprehensive reporting system

### Phase 5: Integration Tests ✅
- [ ] Create account operations test suite
- [ ] Create file operations test suite (when file operations are available)
- [ ] Create performance benchmark test suite
- [ ] Create complex workflow test scenarios
- [ ] Add error handling and edge case tests
- [ ] Test concurrent operations and load scenarios

### Phase 6: CI/CD Integration ✅
- [ ] Update GitHub Actions workflow
- [ ] Add performance threshold validation to CI
- [ ] Configure test result reporting
- [ ] Add performance regression detection
- [ ] Set up test artifact collection
- [ ] Configure failure notifications

### Phase 7: Documentation and Training ✅
- [ ] Create comprehensive usage documentation
- [ ] Add code examples and best practices
- [ ] Create troubleshooting guide
- [ ] Document performance thresholds and expectations
- [ ] Create team training materials
- [ ] Set up knowledge sharing sessions

## Success Metrics

### Quantitative Metrics
- **Test Coverage**: >90% for integration test scenarios
- **Test Execution Time**: <5 minutes for full integration suite
- **Cleanup Success Rate**: >99% for all test resources
- **Performance Consistency**: <10% variance in benchmark results
- **CI/CD Integration**: <2 minutes additional build time

### Qualitative Metrics
- **Developer Experience**: Easy test data creation and cleanup
- **Reliability**: Consistent test results across environments
- **Maintainability**: Clear test structure and documentation
- **Scalability**: Support for large-scale test scenarios
- **Debugging**: Clear error messages and performance insights

## Troubleshooting Guide

### Common Issues

#### 1. Cleanup Failures
```bash
# Check cleanup logs
npm run test:integration -- --verbose

# Run cleanup verification
TEST_CLEANUP_VERIFICATION=true npm run test:integration
```

#### 2. Performance Threshold Violations
```bash
# Run performance analysis
npm run test:integration:performance -- --verbose

# Check memory usage patterns
TEST_PERFORMANCE_TRACKING=true npm run test:integration
```

#### 3. Resource Dependency Issues
```bash
# Enable dependency debugging
DEBUG=resource-tracker npm run test:integration

# Validate dependency chains
npm run test:integration -- --testNamePattern="dependency"
```

### Performance Optimization Tips

1. **Use appropriate sample sizes** - Start with 5-10 samples for development
2. **Enable warmup runs** - Helps stabilize performance measurements
3. **Monitor memory usage** - Track memory leaks in long-running tests
4. **Batch operations** - Use bulk operations for large datasets
5. **Parallel execution** - Run independent tests concurrently

## Conclusion

This comprehensive integration test infrastructure provides:

✅ **Easy Test Data Creation** - One-line generators for any entity
✅ **Automatic Cleanup** - Dependency-aware resource management
✅ **Performance Metrics** - Comprehensive benchmarking and validation
✅ **Reliable Tests** - Consistent results across environments

The infrastructure is designed to scale with the project and provide a solid foundation for all future integration testing needs. It supports complex scenarios, performance monitoring, and maintains high reliability standards while being easy to use and maintain.

**Next Steps**: Begin implementation with Phase 1 (Foundation) and progressively add capabilities as needed. The modular design allows for incremental adoption and customization based on specific project requirements.
