/**
 * System Documentation Resources
 * Provides API documentation and system information
 */

// File system imports for future use
// import { readFileSync, existsSync } from 'fs';
// import { join } from 'path';
import { registerSystemResource } from '../index.js';
import { createLoggerWithConfig } from '../../utils/index.js';
import { getConfigManager } from '../../config/index.js';
import { getAllToolDefinitions } from '../../tools/index.js';

// Initialize logger
const configManager = getConfigManager();
const logger = createLoggerWithConfig(configManager).child('system-docs');

/**
 * Generate tool documentation
 * @param {Object} tool - Tool definition
 * @returns {string} Markdown documentation
 */
function generateToolDoc(tool) {
  let doc = `## ${tool.name}\n\n`;
  doc += `**Description**: ${tool.description}\n\n`;

  if (tool.inputSchema && tool.inputSchema.properties) {
    doc += `### Parameters\n\n`;
    const props = tool.inputSchema.properties;
    const required = tool.inputSchema.required || [];

    Object.entries(props).forEach(([name, prop]) => {
      const isRequired = required.includes(name);
      doc += `- **${name}** ${isRequired ? '(required)' : '(optional)'}: ${prop.description || 'No description'}\n`;
      if (prop.enum) {
        doc += `  - Valid values: ${prop.enum.map((v) => `\`${v}\``).join(', ')}\n`;
      }
    });
    doc += '\n';
  }

  return doc;
}

/**
 * Register system documentation resources
 */
export async function registerResources() {
  logger.info('Registering system documentation resources');

  // API Documentation Resource
  registerSystemResource({
    name: 'api-docs',
    title: 'Huly MCP Server API Documentation',
    description: 'Complete API documentation for all available MCP tools and workflows',
    mimeType: 'text/markdown',
    handler: async () => {
      try {
        let docs = '# Huly MCP Server API Documentation\n\n';
        docs += 'Complete documentation for all available MCP tools and workflows.\n\n';
        docs += `Generated on: ${new Date().toISOString()}\n\n`;

        // Get all tool definitions
        const tools = getAllToolDefinitions();

        // Group tools by category
        const toolsByCategory = tools.reduce((acc, tool) => {
          // Extract category from tool name prefix
          const parts = tool.name.split('_');
          const category = parts.length > 1 ? parts[1] : 'general';

          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(tool);
          return acc;
        }, {});

        // Generate table of contents
        docs += '## Table of Contents\n\n';
        Object.keys(toolsByCategory)
          .sort()
          .forEach((category) => {
            docs += `- [${category.charAt(0).toUpperCase() + category.slice(1)} Tools](#${category}-tools)\n`;
          });
        docs += '\n---\n\n';

        // Generate documentation for each category
        Object.entries(toolsByCategory)
          .sort()
          .forEach(([category, categoryTools]) => {
            docs += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Tools\n\n`;

            categoryTools.forEach((tool) => {
              docs += generateToolDoc(tool);
            });

            docs += '---\n\n';
          });

        return { text: docs };
      } catch (error) {
        logger.error('Error generating API documentation:', error);
        return {
          text: `# API Documentation Error\n\nFailed to generate documentation: ${error.message}`,
        };
      }
    },
    annotations: {
      cost: 'low',
      speed: 'fast',
      category: 'documentation',
    },
  });

  // Workflow Guide Resource
  registerSystemResource({
    name: 'workflow-guide',
    title: 'Workflow Integration Guide',
    description: 'Guide for integrating Huly MCP workflows with development processes',
    mimeType: 'text/markdown',
    handler: async () => {
      return {
        text: `# Huly MCP Workflow Integration Guide

## Overview

The Huly MCP Server provides seamless integration between your development workflow and Huly project management through MCP resources and tools.

## Available Workflows

### Git Worktree Workflows

#### 1. Worktree Creation (\`huly://workflows/worktree-create\`)
- **Purpose**: Create isolated development environments for each issue
- **Integration**: Automatically updates Huly issue status to "In Progress"
- **Usage**: Specify issue number, branch type, and optional description
- **Benefits**: Clean separation of features, automatic context switching

#### 2. Pull Request Creation (\`huly://workflows/worktree-pr\`)
- **Purpose**: Create GitHub pull requests with proper metadata
- **Integration**: Updates Huly issue status to "In Review"
- **Usage**: Automatically detects current branch and generates PR
- **Benefits**: Consistent PR format, automatic issue linking

#### 3. Merge & Cleanup (\`huly://workflows/worktree-merge\`)
- **Purpose**: Complete the development cycle with proper cleanup
- **Integration**: Updates Huly issue status to "Done"
- **Usage**: Merges PR locally and removes worktree
- **Benefits**: Clean repository state, automatic issue completion

#### 4. Status Updates (\`huly://workflows/huly-status\`)
- **Purpose**: Quick issue status updates from any context
- **Integration**: Direct Huly API integration
- **Usage**: Specify issue number and new status
- **Benefits**: Fast status changes without UI context switching

## Integration Patterns

### Development Lifecycle
1. **Planning**: Review \`huly://system/projects-overview\` for project status
2. **Start Work**: Use \`huly://workflows/worktree-create\` to begin development
3. **Progress**: Monitor with \`huly://projects/{id}/summary\` resource
4. **Review**: Create PR with \`huly://workflows/worktree-pr\`
5. **Complete**: Merge and cleanup with \`huly://workflows/worktree-merge\`

### Team Coordination
- **Activity Monitoring**: \`huly://system/activity-feed\` for team updates
- **Project Health**: \`huly://projects/{id}/health\` for bottleneck identification
- **Documentation**: \`huly://system/api-docs\` for onboarding

## Best Practices

### Branch Naming
- Use descriptive branch types: feature, bugfix, hotfix, docs, refactor
- Include issue context in branch descriptions
- Maintain consistent naming patterns

### Status Management
- Update status immediately when starting work
- Use "In Review" status during code review
- Mark "Done" only after merge completion

### Resource Usage
- Cache project summaries for dashboard views
- Subscribe to activity feeds for real-time updates
- Use workflow resources for automation scripts

## Automation Examples

### CLI Integration
\`\`\`bash
# Start work on issue
mcp-client read "huly://workflows/worktree-create?issue=123&type=feature&desc=search"

# Check project health
mcp-client read "huly://projects/HULLY/health"

# Quick status update
mcp-client read "huly://workflows/huly-status?issue=123&status=done"
\`\`\`

### IDE Integration
- Configure IDE to fetch workflow status on startup
- Set up automatic issue status updates on git operations
- Integrate project health metrics in development dashboard

### CI/CD Integration
- Trigger workflow resources from build pipelines
- Update issue status based on deployment success
- Generate project reports for stakeholders

## Troubleshooting

### Common Issues
1. **Issue Not Found**: Verify issue number exists in Huly
2. **Status Update Failed**: Check Huly authentication and permissions
3. **Worktree Creation Failed**: Ensure clean working directory
4. **Resource Timeout**: Large projects may need increased timeout settings

### Debug Resources
- \`huly://system/status\` - Server health check
- \`huly://system/activity-feed\` - Recent activity verification
- Tool-specific error messages in resource responses

## Advanced Usage

### Custom Workflows
- Extend workflow resources for team-specific processes
- Combine multiple workflow calls for complex automation
- Integrate with external tools through MCP chaining

### Analytics Integration
- Use project health metrics for velocity tracking
- Monitor activity patterns for team optimization
- Export data for external reporting tools

---

*Generated on: ${new Date().toISOString()}*`,
      };
    },
    annotations: {
      cost: 'low',
      speed: 'fast',
      category: 'documentation',
    },
  });

  // System Status Resource
  registerSystemResource({
    name: 'status',
    title: 'System Status',
    description: 'Current status and health of the Huly MCP Server',
    handler: async () => {
      try {
        const startTime = process.hrtime();

        // Test Huly connectivity
        let hulyStatus = 'unknown';
        try {
          const { ServiceRegistry } = await import('../../services/index.js');
          const serviceRegistry = ServiceRegistry.getInstance();
          const projectService = serviceRegistry.getService('projectService');
          await projectService.listProjects({ limit: 1 });
          hulyStatus = 'connected';
        } catch {
          hulyStatus = 'disconnected';
        }

        const endTime = process.hrtime(startTime);
        const responseTime = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);

        return {
          text: JSON.stringify(
            {
              service: 'Huly MCP Server',
              status: 'healthy',
              version: '2.0.0-beta',
              uptime: process.uptime(),
              memory_usage: process.memoryUsage(),
              response_time_ms: parseFloat(responseTime),
              integrations: {
                huly_api: hulyStatus,
                mcp_protocol: 'active',
              },
              features: {
                workflows: 'enabled',
                resources: 'enabled',
                project_analytics: 'enabled',
              },
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        logger.error('Error generating status:', error);
        return {
          text: JSON.stringify(
            {
              service: 'Huly MCP Server',
              status: 'error',
              error: error.message,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      }
    },
    annotations: {
      cost: 'low',
      speed: 'fast',
      category: 'monitoring',
    },
  });

  logger.info('System documentation resources registered successfully');
}
