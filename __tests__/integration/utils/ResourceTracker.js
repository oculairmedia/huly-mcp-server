/**
 * Resource Tracker for Integration Testing
 *
 * Tracks test resources with dependency management and intelligent cleanup
 */

export class ResourceTracker {
  constructor() {
    this.resources = new Map(); // resourceId -> { type, metadata, createdAt }
    this.dependencies = new Map(); // parentId -> Set<childId>
    this.reverseDependencies = new Map(); // childId -> Set<parentId>
    this.cleanupCallbacks = new Map(); // type -> cleanup function
    this.cleanupHistory = [];
  }

  /**
   * Register cleanup function for a resource type
   * @param {string} type - Resource type
   * @param {Function} cleanupFn - Cleanup function
   */
  registerCleanupCallback(type, cleanupFn) {
    this.cleanupCallbacks.set(type, cleanupFn);
    console.log(`📋 Registered cleanup callback for ${type}`);
  }

  /**
   * Track a resource with optional metadata
   * @param {string} type - Resource type
   * @param {string} id - Resource identifier
   * @param {Object} metadata - Additional resource metadata
   */
  track(type, id, metadata = {}) {
    this.resources.set(id, {
      type,
      metadata,
      createdAt: new Date(),
      cleanedUp: false,
    });

    console.log(`📝 Tracking ${type}: ${id}`);
  }

  /**
   * Add dependency relationship (parent depends on child existing)
   * @param {string} parentId - Parent resource ID
   * @param {string} childId - Child resource ID
   */
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

  /**
   * Calculate cleanup order using topological sort
   * @returns {Array} Ordered list of resource IDs for cleanup
   */
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

      // Visit all dependencies first (children must be cleaned up before parents)
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

  /**
   * Cleanup all tracked resources
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanup(options = {}) {
    const { dryRun = false, maxRetries = 3, batchSize = 10, continueOnError = true } = options;

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
      errors: [],
      duration: 0,
    };

    const startTime = Date.now();

    // Process in batches
    for (let i = 0; i < cleanupOrder.length; i += batchSize) {
      const batch = cleanupOrder.slice(i, i + batchSize);
      console.log(
        `\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cleanupOrder.length / batchSize)}`
      );

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

    results.duration = Date.now() - startTime;

    // Calculate success rate
    results.successRate = results.total > 0 ? (results.successful / results.total) * 100 : 100;

    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${results.successRate.toFixed(1)}%`);
    console.log(`⏱️  Duration: ${results.duration}ms`);

    if (results.errors.length > 0) {
      console.log('\n❌ Cleanup Errors:');
      results.errors.forEach(({ resourceId, error }) => {
        console.log(`   ${resourceId}: ${error}`);
      });
    }

    this.cleanupHistory.push({
      timestamp: new Date(),
      results,
      options,
    });

    return results;
  }

  /**
   * Cleanup a single resource with retry logic
   * @param {string} resourceId - Resource ID
   * @param {Object} resource - Resource data
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup result
   */
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
        error: `No cleanup function registered for type: ${type}`,
      };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await cleanupFn(resourceId, resource.metadata);
        return { resourceId, success: true };
      } catch (error) {
        console.log(
          `⚠️  Cleanup attempt ${attempt}/${maxRetries} failed for ${resourceId}: ${error.message}`
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          return { resourceId, success: false, error: error.message };
        }
      }
    }
  }

  /**
   * Get resource by ID
   * @param {string} resourceId - Resource ID
   * @returns {Object|null} Resource data
   */
  getResource(resourceId) {
    return this.resources.get(resourceId) || null;
  }

  /**
   * Get all resources of a specific type
   * @param {string} type - Resource type
   * @returns {Array} Resources of the specified type
   */
  getResourcesByType(type) {
    const results = [];
    for (const [id, resource] of this.resources) {
      if (resource.type === type) {
        results.push({ id, ...resource });
      }
    }
    return results;
  }

  /**
   * Check if resource exists and is tracked
   * @param {string} resourceId - Resource ID
   * @returns {boolean} True if resource is tracked
   */
  isTracked(resourceId) {
    return this.resources.has(resourceId);
  }

  /**
   * Get dependencies for a resource
   * @param {string} resourceId - Resource ID
   * @returns {Array} Array of dependent resource IDs
   */
  getDependencies(resourceId) {
    const deps = this.dependencies.get(resourceId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get reverse dependencies for a resource
   * @param {string} resourceId - Resource ID
   * @returns {Array} Array of resources that depend on this resource
   */
  getReverseDependencies(resourceId) {
    const deps = this.reverseDependencies.get(resourceId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get cleanup statistics
   * @returns {Object} Statistics about tracked resources
   */
  getStats() {
    const totalResources = this.resources.size;
    const cleanedUp = Array.from(this.resources.values()).filter((r) => r.cleanedUp).length;
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
      byType: Object.fromEntries(typeStats),
      successRate: totalResources > 0 ? (cleanedUp / totalResources) * 100 : 100,
    };
  }

  /**
   * Get cleanup history
   * @returns {Array} History of cleanup operations
   */
  getCleanupHistory() {
    return [...this.cleanupHistory];
  }

  /**
   * Validate dependency graph for cycles
   * @returns {Object} Validation results
   */
  validateDependencyGraph() {
    const results = {
      valid: true,
      cycles: [],
      orphanedResources: [],
      danglingDependencies: [],
    };

    try {
      this.calculateCleanupOrder();
    } catch (error) {
      results.valid = false;
      if (error.message.includes('Circular dependency')) {
        const match = error.message.match(/involving (.+)$/);
        if (match) {
          results.cycles.push(match[1]);
        }
      }
    }

    // Check for orphaned resources (resources that depend on non-existent resources)
    for (const [parentId, childIds] of this.dependencies) {
      for (const childId of childIds) {
        if (!this.resources.has(childId)) {
          results.danglingDependencies.push({ parent: parentId, child: childId });
        }
      }
    }

    // Check for resources without dependencies (potential orphans)
    for (const resourceId of this.resources.keys()) {
      const hasDependencies = this.dependencies.has(resourceId);
      const hasReverseDependencies = this.reverseDependencies.has(resourceId);

      if (!hasDependencies && !hasReverseDependencies) {
        results.orphanedResources.push(resourceId);
      }
    }

    return results;
  }

  /**
   * Clear all tracking data
   */
  reset() {
    this.resources.clear();
    this.dependencies.clear();
    this.reverseDependencies.clear();
    this.cleanupHistory = [];
    console.log('🔄 Resource tracker reset');
  }

  /**
   * Export tracking data for debugging
   * @returns {Object} Complete tracking data
   */
  exportData() {
    return {
      resources: Object.fromEntries(this.resources),
      dependencies: Object.fromEntries(
        Array.from(this.dependencies.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      reverseDependencies: Object.fromEntries(
        Array.from(this.reverseDependencies.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      cleanupHistory: this.cleanupHistory,
      stats: this.getStats(),
    };
  }

  /**
   * Import tracking data for testing
   * @param {Object} data - Tracking data to import
   */
  importData(data) {
    this.reset();

    if (data.resources) {
      this.resources = new Map(Object.entries(data.resources));
    }

    if (data.dependencies) {
      this.dependencies = new Map(
        Object.entries(data.dependencies).map(([k, v]) => [k, new Set(v)])
      );
    }

    if (data.reverseDependencies) {
      this.reverseDependencies = new Map(
        Object.entries(data.reverseDependencies).map(([k, v]) => [k, new Set(v)])
      );
    }

    if (data.cleanupHistory) {
      this.cleanupHistory = data.cleanupHistory;
    }
  }
}

// Export singleton instance for convenience
export const resourceTracker = new ResourceTracker();
