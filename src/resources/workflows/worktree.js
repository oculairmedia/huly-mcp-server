/**
 * Worktree Workflow Resources
 * Converts existing slash commands to MCP resources
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { registerWorkflowResource } from '../index.js';
import { createLoggerWithConfig } from '../../utils/index.js';
import { getConfigManager } from '../../config/index.js';

// Initialize logger
const configManager = getConfigManager();
const logger = createLoggerWithConfig(configManager).child('worktree-workflows');

/**
 * Execute shell script and return output
 * @param {string} scriptPath - Path to script
 * @param {Array} args - Script arguments
 * @returns {string} Script output
 */
function executeScript(scriptPath, args = []) {
  try {
    const fullPath = join(process.cwd(), 'scripts', scriptPath);
    if (!existsSync(fullPath)) {
      throw new Error(`Script not found: ${fullPath}`);
    }

    const command = `${fullPath} ${args.join(' ')}`;
    const output = execSync(command, { encoding: 'utf8', cwd: process.cwd() });
    return output;
  } catch (error) {
    logger.error(`Error executing script ${scriptPath}:`, error);
    throw error;
  }
}

/**
 * Read markdown command file and extract metadata
 * @param {string} commandName - Command name
 * @returns {Object} Command metadata
 */
function getCommandMetadata(commandName) {
  const commandPath = join(process.cwd(), '.claude', 'commands', `${commandName}.md`);

  if (!existsSync(commandPath)) {
    return { description: `${commandName} workflow` };
  }

  try {
    const content = readFileSync(commandPath, 'utf8');
    const lines = content.split('\n');
    const metadata = {};

    // Extract frontmatter
    if (lines[0] === '---') {
      let i = 1;
      while (i < lines.length && lines[i] !== '---') {
        const line = lines[i].trim();
        if (line.includes(':')) {
          const [key, ...valueParts] = line.split(':');
          metadata[key.trim()] = valueParts.join(':').trim();
        }
        i++;
      }
    }

    return metadata;
  } catch (error) {
    logger.warn(`Error reading command metadata for ${commandName}:`, error);
    return { description: `${commandName} workflow` };
  }
}

/**
 * Register all worktree workflow resources
 */
export async function registerResources() {
  logger.info('Registering worktree workflow resources');

  // Worktree Create Workflow
  registerWorkflowResource({
    name: 'worktree-create',
    title: 'Git Worktree Creation Workflow',
    description:
      'Interactive workflow for creating Git worktrees with Huly integration and automatic issue status updates',
    handler: async (_services) => {
      try {
        // Get current worktree status
        const worktreeList = executeScript('worktree-list.sh');

        // Get command metadata
        const metadata = getCommandMetadata('worktree-create');

        return {
          text: JSON.stringify(
            {
              workflow: 'worktree-create',
              description: 'Create a Git worktree for a Huly issue',
              usage: {
                parameters: [
                  {
                    name: 'issue_number',
                    required: true,
                    description: 'Huly issue number (e.g., 123)',
                  },
                  {
                    name: 'type',
                    required: true,
                    description: 'Branch type (feature, bugfix, hotfix, docs, refactor)',
                  },
                  {
                    name: 'description',
                    required: false,
                    description: 'Optional branch description',
                  },
                ],
                examples: [
                  'issue_number=123 type=feature description=search-functionality',
                  'issue_number=456 type=bugfix description=fix-validation',
                ],
              },
              current_worktrees: worktreeList
                .trim()
                .split('\n')
                .filter((line) => line.length > 0),
              automation: {
                creates_branch: true,
                updates_issue_status: 'in-progress',
                switches_context: true,
              },
              metadata: metadata,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        logger.error('Error in worktree-create workflow:', error);
        return {
          text: JSON.stringify(
            {
              workflow: 'worktree-create',
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
      category: 'development',
    },
  });

  // Worktree Merge Workflow
  registerWorkflowResource({
    name: 'worktree-merge',
    title: 'Git Worktree Merge & Cleanup Workflow',
    description:
      'Complete workflow for merging pull requests and cleaning up worktrees with Huly status updates',
    handler: async (_services) => {
      try {
        const worktreeList = executeScript('worktree-list.sh');
        const metadata = getCommandMetadata('worktree-merge');

        return {
          text: JSON.stringify(
            {
              workflow: 'worktree-merge',
              description: 'Merge PR and cleanup worktree with Huly integration',
              usage: {
                parameters: [
                  {
                    name: 'issue_number',
                    required: true,
                    description: 'Huly issue number to merge',
                  },
                ],
                examples: ['issue_number=123'],
              },
              current_worktrees: worktreeList
                .trim()
                .split('\n')
                .filter((line) => line.length > 0),
              automation: {
                merges_locally: true,
                removes_worktree: true,
                updates_issue_status: 'done',
                triggers_hooks: true,
              },
              prerequisites: [
                'PR must be approved and ready to merge',
                'Working directory must be clean',
                'Issue must exist and be in progress',
              ],
              metadata: metadata,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        logger.error('Error in worktree-merge workflow:', error);
        return {
          text: JSON.stringify(
            {
              workflow: 'worktree-merge',
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
      cost: 'medium',
      speed: 'medium',
      category: 'development',
    },
  });

  // Worktree PR Creation Workflow
  registerWorkflowResource({
    name: 'worktree-pr',
    title: 'Pull Request Creation Workflow',
    description: 'Automated pull request creation with GitHub integration and Huly status updates',
    handler: async (_services) => {
      try {
        const metadata = getCommandMetadata('worktree-pr');

        return {
          text: JSON.stringify(
            {
              workflow: 'worktree-pr',
              description: 'Create pull request for current branch',
              usage: {
                parameters: [],
                notes: 'Automatically detects current branch and creates PR',
              },
              automation: {
                creates_pr: true,
                sets_github_token: true,
                updates_issue_status: 'in-review',
                generates_pr_description: true,
              },
              requirements: [
                'Must be on a feature branch',
                'GitHub token must be configured',
                'Branch must have commits to push',
              ],
              metadata: metadata,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        logger.error('Error in worktree-pr workflow:', error);
        return {
          text: JSON.stringify(
            {
              workflow: 'worktree-pr',
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
      cost: 'medium',
      speed: 'fast',
      category: 'development',
    },
  });

  // Huly Status Update Workflow
  registerWorkflowResource({
    name: 'huly-status',
    title: 'Huly Issue Status Update Workflow',
    description: 'Quick status update workflow for Huly issues with validation',
    handler: async (_services) => {
      try {
        const metadata = getCommandMetadata('huly-status');

        return {
          text: JSON.stringify(
            {
              workflow: 'huly-status',
              description: 'Update Huly issue status quickly',
              usage: {
                parameters: [
                  { name: 'issue_number', required: true, description: 'Huly issue number' },
                  { name: 'status', required: true, description: 'New status value' },
                ],
                examples: ['issue_number=123 status=in-progress', 'issue_number=456 status=done'],
              },
              valid_statuses: [
                { value: 'backlog', description: 'Move to Backlog' },
                { value: 'todo', description: 'Move to Todo' },
                { value: 'in-progress', description: 'Move to InProgress' },
                { value: 'active', description: 'Move to InProgress (alias)' },
                { value: 'done', description: 'Mark as Done' },
                { value: 'completed', description: 'Mark as Done (alias)' },
                { value: 'canceled', description: 'Cancel the issue' },
              ],
              automation: {
                validates_issue_exists: true,
                updates_status: true,
                shows_confirmation: true,
              },
              metadata: metadata,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        logger.error('Error in huly-status workflow:', error);
        return {
          text: JSON.stringify(
            {
              workflow: 'huly-status',
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
      category: 'project-management',
    },
  });

  logger.info('Worktree workflow resources registered successfully');
}
