/**
 * Performance Benchmark for Integration Testing
 *
 * Measures operation performance with thresholds, statistical analysis, and reporting
 */

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
      ...options,
    };
  }

  /**
   * Set performance threshold for an operation
   * @param {string} operation - Operation name
   * @param {Object|number} config - Threshold configuration or max duration
   */
  setThreshold(operation, config) {
    if (typeof config === 'number') {
      config = { maxDuration: config };
    }

    this.thresholds.set(operation, {
      maxDuration: config.maxDuration,
      maxMemoryIncrease: config.maxMemoryIncrease || 50 * 1024 * 1024, // 50MB
      minThroughput: config.minThroughput,
      ...config,
    });
  }

  /**
   * Start a performance measurement session
   * @param {string} sessionId - Session identifier
   * @param {Object} metadata - Session metadata
   * @returns {Object} Session object
   */
  startSession(sessionId, metadata = {}) {
    const session = {
      id: sessionId,
      startTime: performance.now(),
      startMemory: this.options.enableMemoryTracking ? process.memoryUsage() : null,
      operations: [],
      metadata,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Measure a single operation with multiple samples
   * @param {string} name - Operation name
   * @param {Function} operation - Async operation to measure
   * @param {Object} options - Measurement options
   * @returns {Promise<Object>} Aggregated measurement results
   */
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
        await new Promise((resolve) => setTimeout(resolve, 100));
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

  /**
   * Measure a single run of an operation
   * @param {string} name - Operation name
   * @param {Function} operation - Operation to measure
   * @param {Object} options - Measurement options
   * @returns {Promise<Object>} Single measurement result
   */
  async measureSingleRun(name, operation, _options = {}) {
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
      result, // Include the operation result
      memory:
        startMemory && endMemory
          ? {
              heapUsedDelta: endMemory.heapUsed - startMemory.heapUsed,
              heapTotalDelta: endMemory.heapTotal - startMemory.heapTotal,
              rssDelta: endMemory.rss - startMemory.rss,
              startHeapUsed: startMemory.heapUsed,
              endHeapUsed: endMemory.heapUsed,
            }
          : null,
    };

    if (error) {
      throw error;
    }

    return measurement;
  }

  /**
   * Aggregate multiple measurements into statistics
   * @param {string} name - Operation name
   * @param {Array} measurements - Array of measurements
   * @returns {Object} Aggregated statistics
   */
  aggregateMeasurements(name, measurements) {
    const successful = measurements.filter((m) => m.success);
    const durations = successful.map((m) => m.duration);

    if (durations.length === 0) {
      throw new Error(`All measurements for ${name} failed`);
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const memoryDeltas = successful.filter((m) => m.memory).map((m) => m.memory.heapUsedDelta);

    // Include the result from the last successful measurement
    const lastResult = successful.length > 0 ? successful[successful.length - 1].result : null;

    return {
      name,
      samples: measurements.length,
      successful: successful.length,
      failed: measurements.length - successful.length,
      result: lastResult, // Include the operation result
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        mean: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        stdDev: this.calculateStandardDeviation(durations),
      },
      memory:
        memoryDeltas.length > 0
          ? {
              minDelta: Math.min(...memoryDeltas),
              maxDelta: Math.max(...memoryDeltas),
              meanDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
              totalIncrease: memoryDeltas.reduce((sum, delta) => sum + Math.max(0, delta), 0),
            }
          : null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate standard deviation
   * @param {Array} values - Array of numeric values
   * @returns {number} Standard deviation
   */
  calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Record a measurement
   * @param {string} name - Operation name
   * @param {Object} measurement - Measurement data
   */
  recordMeasurement(name, measurement) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(measurement);
  }

  /**
   * Validate performance against thresholds
   * @returns {Object} Validation results
   */
  validatePerformance() {
    const results = {
      passed: 0,
      failed: 0,
      violations: [],
    };

    for (const [operation, threshold] of this.thresholds) {
      const measurements = this.metrics.get(operation);
      if (!measurements || measurements.length === 0) {
        results.violations.push({
          operation,
          type: 'missing',
          message: `No measurements found for ${operation}`,
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

  /**
   * Check individual thresholds
   * @param {string} operation - Operation name
   * @param {Object} measurement - Measurement data
   * @param {Object} threshold - Threshold configuration
   * @returns {Array} Array of violations
   */
  checkThresholds(operation, measurement, threshold) {
    const violations = [];

    // Duration threshold
    if (threshold.maxDuration && measurement.duration.p95 > threshold.maxDuration) {
      violations.push({
        operation,
        type: 'duration',
        message: `P95 duration ${measurement.duration.p95.toFixed(2)}ms exceeds threshold ${threshold.maxDuration}ms`,
        actual: measurement.duration.p95,
        threshold: threshold.maxDuration,
      });
    }

    // Memory threshold
    if (
      threshold.maxMemoryIncrease &&
      measurement.memory &&
      measurement.memory.meanDelta > threshold.maxMemoryIncrease
    ) {
      violations.push({
        operation,
        type: 'memory',
        message: `Memory increase ${(measurement.memory.meanDelta / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(threshold.maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB`,
        actual: measurement.memory.meanDelta,
        threshold: threshold.maxMemoryIncrease,
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
          threshold: threshold.minThroughput,
        });
      }
    }

    return violations;
  }

  /**
   * End a performance session
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session summary
   */
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

  /**
   * Generate performance report
   * @param {Object} options - Report options
   * @returns {Object|string} Performance report
   */
  generateReport(options = {}) {
    const { format = 'text', includeRaw = false } = options;

    const report = {
      summary: this.generateSummary(),
      operations: this.generateOperationReports(),
      thresholds: this.validatePerformance(),
      sessions: Array.from(this.sessions.values()),
      timestamp: new Date().toISOString(),
    };

    if (includeRaw) {
      report.rawMetrics = Object.fromEntries(this.metrics);
    }

    if (format === 'text') {
      return this.formatTextReport(report);
    }

    return report;
  }

  /**
   * Generate summary statistics
   * @returns {Object} Summary statistics
   */
  generateSummary() {
    const totalOperations = this.metrics.size;
    const totalMeasurements = Array.from(this.metrics.values()).reduce(
      (sum, measurements) => sum + measurements.length,
      0
    );

    return {
      totalOperations,
      totalMeasurements,
      averageMeasurementsPerOperation: totalMeasurements / totalOperations || 0,
      sessionsCount: this.sessions.size,
    };
  }

  /**
   * Generate operation-specific reports
   * @returns {Object} Operation reports
   */
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
        status: threshold
          ? this.checkThresholds(operation, latest, threshold).length === 0
            ? 'pass'
            : 'fail'
          : 'unknown',
      };
    }

    return reports;
  }

  /**
   * Calculate performance trend
   * @param {Array} measurements - Array of measurements
   * @returns {string} Trend indicator
   */
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

  /**
   * Format text report
   * @param {Object} report - Report data
   * @returns {string} Formatted text report
   */
  formatTextReport(report) {
    let text = '\n📊 PERFORMANCE REPORT\n';
    text += `${'='.repeat(50)}\n\n`;

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
      text += `     Duration: ${latest.duration.mean.toFixed(2)}ms (±${latest.duration.stdDev.toFixed(2)}ms)\n`;
      text += `     P95: ${latest.duration.p95.toFixed(2)}ms\n`;
      text += `     P99: ${latest.duration.p99.toFixed(2)}ms\n`;
      if (latest.memory) {
        text += `     Memory: ${(latest.memory.meanDelta / 1024 / 1024).toFixed(2)}MB avg delta\n`;
      }
      text += '\n';
    }

    return text;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
    this.sessions.clear();
  }

  /**
   * Get all measurements for an operation
   * @param {string} operation - Operation name
   * @returns {Array} Array of measurements
   */
  getMeasurements(operation) {
    return this.metrics.get(operation) || [];
  }

  /**
   * Get session data
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session data
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
}

// Export singleton instance for convenience
export const performanceBenchmark = new PerformanceBenchmark();
