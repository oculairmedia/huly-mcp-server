/**
 * Test Reporter
 * Generates comprehensive test reports in multiple formats
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class TestReporter {
  constructor(config) {
    this.config = config;
    this.results = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      },
      tests: [],
      errors: [],
      warnings: [],
      performance: {},
    };
    this.startTime = Date.now();
  }

  // Record test result
  recordTest(name, status, details = {}) {
    const test = {
      name,
      status,
      duration: details.duration || 0,
      timestamp: new Date().toISOString(),
      ...details,
    };

    this.results.tests.push(test);
    this.results.summary.total++;
    this.results.summary[status]++;

    // Console output with colors
    const symbols = {
      passed: '✅',
      failed: '❌',
      skipped: '⚠️',
      error: '💥',
    };

    console.log(`${symbols[status]} ${name} (${test.duration}ms)`);

    if (status === 'failed' && details.error) {
      console.log(`   Error: ${details.error}`);
      this.results.errors.push({ test: name, error: details.error });
    }
  }

  // Record performance metrics
  recordPerformance(operation, duration) {
    if (!this.results.performance[operation]) {
      this.results.performance[operation] = [];
    }
    this.results.performance[operation].push(duration);
  }

  // Generate summary report
  generateSummary() {
    this.results.summary.duration = Date.now() - this.startTime;

    const { summary } = this.results;
    const passRate = ((summary.passed / summary.total) * 100).toFixed(1);

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed} (${passRate}%)`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⚠️  Skipped: ${summary.skipped}`);
    console.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(60));

    // Performance summary
    if (Object.keys(this.results.performance).length > 0) {
      console.log('\n📈 PERFORMANCE METRICS');
      console.log('='.repeat(60));

      for (const [op, durations] of Object.entries(this.results.performance)) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const max = Math.max(...durations);
        const min = Math.min(...durations);

        console.log(`${op}:`);
        console.log(`  Average: ${avg.toFixed(0)}ms`);
        console.log(`  Min: ${min}ms, Max: ${max}ms`);
      }
    }

    // Failed tests details
    if (this.results.errors.length > 0) {
      console.log('\n❌ FAILED TESTS');
      console.log('='.repeat(60));

      for (const { test, error } of this.results.errors) {
        console.log(`\n${test}:`);
        console.log(`  ${error}`);
      }
    }
  }

  // Save results to file
  saveResults() {
    if (!this.config.logging.saveResults) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsDir = this.config.logging.resultsPath;

    // Create results directory
    mkdirSync(resultsDir, { recursive: true });

    // Save JSON report
    const jsonPath = join(resultsDir, `test-results-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Results saved to: ${jsonPath}`);

    // Save JUnit XML for CI/CD
    const junitXml = this.generateJUnitXML();
    const xmlPath = join(resultsDir, `junit-${timestamp}.xml`);
    writeFileSync(xmlPath, junitXml);
    console.log(`📄 JUnit report saved to: ${xmlPath}`);

    // Save HTML report
    const html = this.generateHTMLReport();
    const htmlPath = join(resultsDir, `report-${timestamp}.html`);
    writeFileSync(htmlPath, html);
    console.log(`📄 HTML report saved to: ${htmlPath}`);
  }

  // Generate JUnit XML format
  generateJUnitXML() {
    const { summary, tests } = this.results;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites tests="${summary.total}" failures="${summary.failed}" time="${summary.duration / 1000}">\n`;
    xml += '  <testsuite name="MCP Integration Tests">\n';

    for (const test of tests) {
      xml += `    <testcase name="${test.name}" time="${test.duration / 1000}">\n`;
      if (test.status === 'failed') {
        xml += `      <failure message="${test.error}"/>\n`;
      }
      xml += '    </testcase>\n';
    }

    xml += '  </testsuite>\n';
    xml += '</testsuites>';

    return xml;
  }

  // Generate HTML report
  generateHTMLReport() {
    const { summary, tests, performance } = this.results;

    return `<!DOCTYPE html>
<html>
<head>
  <title>MCP Integration Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 8px; }
    .passed { color: green; }
    .failed { color: red; }
    .skipped { color: orange; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
    .error { background: #ffeeee; }
  </style>
</head>
<body>
  <h1>MCP Integration Test Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Total Tests: ${summary.total}</p>
    <p class="passed">Passed: ${summary.passed}</p>
    <p class="failed">Failed: ${summary.failed}</p>
    <p class="skipped">Skipped: ${summary.skipped}</p>
    <p>Duration: ${(summary.duration / 1000).toFixed(2)}s</p>
  </div>
  
  <h2>Test Results</h2>
  <table>
    <tr>
      <th>Test Name</th>
      <th>Status</th>
      <th>Duration (ms)</th>
      <th>Details</th>
    </tr>
    ${tests
      .map(
        (test) => `
    <tr class="${test.status === 'failed' ? 'error' : ''}">
      <td>${test.name}</td>
      <td class="${test.status}">${test.status}</td>
      <td>${test.duration}</td>
      <td>${test.error || '-'}</td>
    </tr>
    `
      )
      .join('')}
  </table>
  
  <h2>Performance Metrics</h2>
  <table>
    <tr>
      <th>Operation</th>
      <th>Average (ms)</th>
      <th>Min (ms)</th>
      <th>Max (ms)</th>
    </tr>
    ${Object.entries(performance)
      .map(([op, durations]) => {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        return `
      <tr>
        <td>${op}</td>
        <td>${avg.toFixed(0)}</td>
        <td>${Math.min(...durations)}</td>
        <td>${Math.max(...durations)}</td>
      </tr>
      `;
      })
      .join('')}
  </table>
</body>
</html>`;
  }
}
