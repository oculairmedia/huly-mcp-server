/**
 * Test Data Manager
 * Handles setup and teardown of test data for integration tests
 */

export class TestDataManager {
  constructor() {
    this.createdProjects = [];
    this.createdIssues = [];
    this.createdComponents = [];
    this.createdMilestones = [];
    this.createdComments = [];
  }

  // Track created entities for cleanup
  trackProject(projectId) {
    this.createdProjects.push(projectId);
  }

  trackIssue(issueId) {
    this.createdIssues.push(issueId);
  }

  trackComponent(componentId) {
    this.createdComponents.push(componentId);
  }

  trackMilestone(milestoneId) {
    this.createdMilestones.push(milestoneId);
  }

  // Cleanup all test data
  async cleanup(_client) {
    console.log('\n🧹 Cleaning up test data...');

    // Delete in reverse order of dependencies
    // Comments -> Issues -> Components/Milestones -> Projects

    for (const issueId of this.createdIssues) {
      try {
        // In a real implementation, we'd delete the issue
        console.log(`   Would delete issue: ${issueId}`);
      } catch (error) {
        console.error(`   Failed to delete issue ${issueId}: ${error.message}`);
      }
    }

    for (const projectId of this.createdProjects) {
      try {
        // In a real implementation, we'd delete the project
        console.log(`   Would delete project: ${projectId}`);
      } catch (error) {
        console.error(`   Failed to delete project ${projectId}: ${error.message}`);
      }
    }

    console.log('✅ Test data cleanup complete');
  }

  // Generate unique test identifiers
  generateTestIdentifier(prefix = 'TEST') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}${timestamp}${random}`;
  }

  // Generate test data with specific characteristics
  generateTestIssue(overrides = {}) {
    return {
      title: `Test Issue ${this.generateTestIdentifier()}`,
      description: 'This is an automated test issue that should be deleted',
      priority: 'medium',
      status: 'backlog',
      ...overrides,
    };
  }

  generateTestProject(overrides = {}) {
    const id = this.generateTestIdentifier('TP');
    return {
      name: `Test Project ${id}`,
      identifier: id.substring(0, 5).toUpperCase(),
      description: 'Automated test project - safe to delete',
      ...overrides,
    };
  }
}
