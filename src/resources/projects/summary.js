/**
 * Project Summary Resources
 * Provides live project information and health metrics
 */

import { registerProjectResourceTemplate, registerSystemResource } from '../index.js';
import { createLoggerWithConfig } from '../../utils/index.js';
import { getConfigManager } from '../../config/index.js';
import { HulyClient } from '../../core/HulyClient.js';

// Initialize logger and client
const configManager = getConfigManager();
const logger = createLoggerWithConfig(configManager).child('project-resources');
const hulyClient = new HulyClient(configManager);

/**
 * Register project summary resources
 */
export async function registerResources() {
  logger.info('Registering project summary resources');

  // Project Summary Template
  registerProjectResourceTemplate({
    name: 'summary',
    title: 'Project Summary',
    description: 'Live project overview with issue counts, progress, and recent activity',
    mimeType: 'application/json',
  });

  // Project Health Template
  registerProjectResourceTemplate({
    name: 'health',
    title: 'Project Health Metrics',
    description: 'Project health indicators including velocity, blockers, and team workload',
    mimeType: 'application/json',
  });

  // All Projects Overview Resource
  registerSystemResource({
    name: 'projects-overview',
    title: 'All Projects Overview',
    description: 'Summary of all projects with key metrics and status indicators',
    handler: async () => {
      try {
        // Get all projects
        const projects = await hulyClient.listProjects();

        const projectSummaries = await Promise.all(
          projects.map(async (project) => {
            try {
              // Get issues for each project
              const issues = await hulyClient.listIssues(project.identifier, { limit: 1000 });

              // Calculate metrics
              const statusCounts = issues.reduce((acc, issue) => {
                const status = issue.status?.title || 'Unknown';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
              }, {});

              const priorityCounts = issues.reduce((acc, issue) => {
                const priority = issue.priority || 'None';
                acc[priority] = (acc[priority] || 0) + 1;
                return acc;
              }, {});

              // Calculate completion rate
              const totalIssues = issues.length;
              const completedIssues = statusCounts['Done'] || 0;
              const completionRate =
                totalIssues > 0 ? ((completedIssues / totalIssues) * 100).toFixed(1) : 0;

              // Find recent activity
              const recentIssues = issues
                .sort(
                  (a, b) =>
                    new Date(b.modifiedOn || b.createdOn) - new Date(a.modifiedOn || a.createdOn)
                )
                .slice(0, 5);

              return {
                project: {
                  id: project._id,
                  identifier: project.identifier,
                  name: project.name,
                  description: project.description,
                  private: project.private,
                  archived: project.archived,
                },
                metrics: {
                  total_issues: totalIssues,
                  completion_rate: `${completionRate}%`,
                  status_breakdown: statusCounts,
                  priority_breakdown: priorityCounts,
                },
                recent_activity: recentIssues.map((issue) => ({
                  identifier: issue.identifier,
                  title: issue.title,
                  status: issue.status?.title,
                  priority: issue.priority,
                  modified: issue.modifiedOn || issue.createdOn,
                })),
                health_indicators: {
                  active_issues: (statusCounts['InProgress'] || 0) + (statusCounts['Todo'] || 0),
                  blocked_issues: statusCounts['Blocked'] || 0,
                  overdue_count: 0, // Would need milestone/due date data
                  velocity_trend: 'stable', // Would need historical data
                },
              };
            } catch (error) {
              logger.error(`Error processing project ${project.identifier}:`, error);
              return {
                project: {
                  identifier: project.identifier,
                  name: project.name,
                  error: error.message,
                },
              };
            }
          })
        );

        return {
          text: JSON.stringify(
            {
              overview: 'All Projects Summary',
              total_projects: projects.length,
              active_projects: projects.filter((p) => !p.archived).length,
              archived_projects: projects.filter((p) => p.archived).length,
              projects: projectSummaries,
              generated_at: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        logger.error('Error generating projects overview:', error);
        return {
          text: JSON.stringify(
            {
              error: 'Failed to generate projects overview',
              message: error.message,
              generated_at: new Date().toISOString(),
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
      category: 'analytics',
    },
  });

  // Project Activity Feed Resource
  registerSystemResource({
    name: 'activity-feed',
    title: 'Global Activity Feed',
    description:
      'Recent activity across all projects including issue updates, comments, and status changes',
    handler: async () => {
      try {
        const projects = await hulyClient.listProjects();
        const allActivity = [];

        // Collect recent issues from all projects
        for (const project of projects) {
          try {
            const issues = await hulyClient.listIssues(project.identifier, { limit: 50 });
            const recentIssues = issues
              .sort(
                (a, b) =>
                  new Date(b.modifiedOn || b.createdOn) - new Date(a.modifiedOn || a.createdOn)
              )
              .slice(0, 10);

            recentIssues.forEach((issue) => {
              allActivity.push({
                type: 'issue_update',
                project: {
                  identifier: project.identifier,
                  name: project.name,
                },
                issue: {
                  identifier: issue.identifier,
                  title: issue.title,
                  status: issue.status?.title,
                  priority: issue.priority,
                },
                timestamp: issue.modifiedOn || issue.createdOn,
                action: issue.modifiedOn ? 'updated' : 'created',
              });
            });
          } catch (error) {
            logger.warn(`Error getting activity for project ${project.identifier}:`, error);
          }
        }

        // Sort all activity by timestamp
        allActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
          text: JSON.stringify(
            {
              activity_feed: 'Global Project Activity',
              total_items: allActivity.length,
              recent_activity: allActivity.slice(0, 50),
              generated_at: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      } catch (error) {
        logger.error('Error generating activity feed:', error);
        return {
          text: JSON.stringify(
            {
              error: 'Failed to generate activity feed',
              message: error.message,
              generated_at: new Date().toISOString(),
            },
            null,
            2
          ),
        };
      }
    },
    annotations: {
      cost: 'high',
      speed: 'slow',
      category: 'analytics',
    },
  });

  logger.info('Project summary resources registered successfully');
}
