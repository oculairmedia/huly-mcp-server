/**
 * WizardResources.js
 *
 * MCP resource definitions for wizard UI states and progress tracking.
 * Provides real-time wizard state information as MCP resources.
 */

import { getWizardStateManager } from '../../prompts/base/WizardState.js';
import { promptRegistry } from '../../prompts/index.js';
import { getLogger } from '../../utils/Logger.js';

const logger = getLogger('wizard-resources');

/**
 * Register wizard-related MCP resources
 * @param {Object} resourceRegistry - The MCP resource registry
 */
export function registerWizardResources(resourceRegistry) {
  logger.info('Registering wizard resources');

  // Register resource for active wizard sessions
  resourceRegistry.registerResource({
    uri: 'huly://wizards/sessions',
    name: 'Active Wizard Sessions',
    description: 'List of all active wizard sessions with their current states',
    mimeType: 'application/json',
    handler: getActiveSessionsResource
  });

  // Register resource for wizard catalog
  resourceRegistry.registerResource({
    uri: 'huly://wizards/catalog',
    name: 'Wizard Catalog',
    description: 'Available wizards and their capabilities',
    mimeType: 'application/json',
    handler: getWizardCatalogResource
  });

  // Register dynamic resource template for individual sessions
  resourceRegistry.registerResourceTemplate({
    name: 'wizard_session',
    uriTemplate: 'huly://wizards/session/{sessionId}',
    description: 'Individual wizard session state and progress',
    mimeType: 'application/json',
    handler: getSessionResource
  });

  // Register resource for wizard statistics
  resourceRegistry.registerResource({
    uri: 'huly://wizards/statistics',
    name: 'Wizard Statistics',
    description: 'Usage statistics and performance metrics for wizards',
    mimeType: 'application/json',
    handler: getWizardStatisticsResource
  });

  // Register resource for wizard help
  resourceRegistry.registerResource({
    uri: 'huly://wizards/help',
    name: 'Wizard Help Guide',
    description: 'Interactive help and documentation for using wizards',
    mimeType: 'text/markdown',
    handler: getWizardHelpResource
  });

  logger.info('Wizard resources registered successfully');
}

/**
 * Get active sessions resource
 * @returns {Promise<Object>} Active sessions data
 */
async function getActiveSessionsResource() {
  try {
    const stateManager = getWizardStateManager();
    const sessions = stateManager.getAllSessions();

    const sessionData = sessions.map(session => ({
      id: session.id,
      wizardName: session.wizardDefinition.name,
      currentStep: session.getCurrentStep().name,
      progress: session.getProgress(),
      startTime: session.metadata.startTime,
      lastActivity: session.metadata.lastActivity,
      status: session.isCompleted ? 'completed' : session.isAborted ? 'aborted' : 'active'
    }));

    return {
      contents: [
        {
          uri: 'huly://wizards/sessions',
          mimeType: 'application/json',
          text: JSON.stringify({
            totalSessions: sessionData.length,
            activeSessions: sessionData.filter(s => s.status === 'active').length,
            sessions: sessionData
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error('Failed to get active sessions', { error });
    return {
      contents: [
        {
          uri: 'huly://wizards/sessions',
          mimeType: 'application/json',
          text: JSON.stringify({ error: error.message }, null, 2)
        }
      ]
    };
  }
}

/**
 * Get wizard catalog resource
 * @returns {Promise<Object>} Wizard catalog data
 */
async function getWizardCatalogResource() {
  try {
    const wizards = promptRegistry.getByCategory('wizards');

    const catalog = wizards.map(wizard => {
      const definition = wizard.definition || wizard;
      return {
        name: definition.name,
        description: definition.description,
        category: definition.category || 'wizards',
        steps: definition.steps?.length || 0,
        estimatedTime: definition.annotations?.estimatedTime || 'Unknown',
        tags: definition.annotations?.tags || [],
        arguments: definition.arguments?.map(arg => ({
          name: arg.name,
          description: arg.description,
          required: arg.required || false
        })) || []
      };
    });

    return {
      contents: [
        {
          uri: 'huly://wizards/catalog',
          mimeType: 'application/json',
          text: JSON.stringify({
            totalWizards: catalog.length,
            categories: [...new Set(catalog.map(w => w.category))],
            wizards: catalog
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error('Failed to get wizard catalog', { error });
    return {
      contents: [
        {
          uri: 'huly://wizards/catalog',
          mimeType: 'application/json',
          text: JSON.stringify({ error: error.message }, null, 2)
        }
      ]
    };
  }
}

/**
 * Get individual session resource
 * @param {Object} params - Resource parameters
 * @returns {Promise<Object>} Session data
 */
async function getSessionResource(params) {
  try {
    const { sessionId } = params;
    const stateManager = getWizardStateManager();
    const session = stateManager.getSession(sessionId);

    if (!session) {
      return {
        contents: [
          {
            uri: `huly://wizards/session/${sessionId}`,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Session not found' }, null, 2)
          }
        ]
      };
    }

    const currentStep = session.getCurrentStep();
    const progress = session.getProgress();

    const sessionDetails = {
      id: session.id,
      wizard: {
        name: session.wizardDefinition.name,
        description: session.wizardDefinition.description
      },
      currentStep: {
        id: currentStep.id,
        name: currentStep.name,
        description: currentStep.description,
        form: currentStep.form,
        review: currentStep.review
      },
      progress: {
        currentStepIndex: progress.currentStep,
        totalSteps: progress.totalSteps,
        completedSteps: session.metadata.completedSteps,
        percentage: Math.round(progress.percentage)
      },
      state: session.getAllState(),
      navigation: {
        canGoBack: session.canGoBack(),
        canGoForward: session.hasCompletedStep(currentStep.id)
      },
      metadata: {
        startTime: session.metadata.startTime,
        lastActivity: session.metadata.lastActivity,
        isCompleted: session.isCompleted,
        isAborted: session.isAborted
      }
    };

    return {
      contents: [
        {
          uri: `huly://wizards/session/${sessionId}`,
          mimeType: 'application/json',
          text: JSON.stringify(sessionDetails, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error('Failed to get session resource', { error });
    return {
      contents: [
        {
          uri: `huly://wizards/session/${params.sessionId}`,
          mimeType: 'application/json',
          text: JSON.stringify({ error: error.message }, null, 2)
        }
      ]
    };
  }
}

/**
 * Get wizard statistics resource
 * @returns {Promise<Object>} Statistics data
 */
async function getWizardStatisticsResource() {
  try {
    const stateManager = getWizardStateManager();
    const sessions = stateManager.getAllSessions();

    // Calculate statistics
    const stats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => !s.isCompleted && !s.isAborted).length,
      completedSessions: sessions.filter(s => s.isCompleted).length,
      abortedSessions: sessions.filter(s => s.isAborted).length,
      averageCompletionTime: calculateAverageCompletionTime(sessions),
      mostUsedWizards: getMostUsedWizards(sessions),
      completionRates: calculateCompletionRates(sessions),
      recentActivity: getRecentActivity(sessions)
    };

    return {
      contents: [
        {
          uri: 'huly://wizards/statistics',
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error('Failed to get wizard statistics', { error });
    return {
      contents: [
        {
          uri: 'huly://wizards/statistics',
          mimeType: 'application/json',
          text: JSON.stringify({ error: error.message }, null, 2)
        }
      ]
    };
  }
}

/**
 * Get wizard help resource
 * @returns {Promise<Object>} Help documentation
 */
async function getWizardHelpResource() {
  const helpContent = `# Wizard System Help Guide

## Overview
The Huly MCP Server provides interactive wizards to guide you through complex workflows.

## Available Wizards

### Project Setup Wizard
Creates new projects with team assignments and initial structure.
- **Steps**: 5
- **Time**: 5-10 minutes
- **Use when**: Starting a new project

### Sprint Planning Wizard
Plans sprints with goals, issue selection, and team assignments.
- **Steps**: 6
- **Time**: 10-15 minutes
- **Use when**: Beginning a new sprint

### Issue Workflow Wizard
Creates issues with various methods including bulk operations and templates.
- **Steps**: 5
- **Time**: 5-10 minutes
- **Use when**: Creating multiple issues or using templates

## Using Wizards

### Starting a Wizard
1. Use the prompt system to start a wizard
2. Provide any required arguments
3. Follow the step-by-step guidance

### Navigation
- **Next**: Proceed to the next step
- **Previous**: Go back to review or change previous steps
- **Cancel**: Abort the wizard without saving
- **Finish**: Complete the wizard and apply changes

### Session Management
- Sessions are automatically saved
- You can resume interrupted sessions
- Sessions expire after 30 minutes of inactivity

## Best Practices

1. **Complete all required fields**: Marked with asterisks (*)
2. **Review before finishing**: Check the summary in the final step
3. **Use templates**: Speed up repetitive tasks
4. **Bulk operations**: Create multiple items efficiently

## Troubleshooting

### Session Not Found
- Session may have expired
- Start a new wizard session

### Validation Errors
- Check required fields are filled
- Verify data formats (dates, emails, etc.)

### Connection Issues
- Ensure MCP server is running
- Check network connectivity

## Advanced Features

### Templates
- Create reusable templates for common workflows
- Variables can be used for dynamic content

### Automation
- Set up rules for automatic transitions
- Configure notifications for events

### Bulk Operations
- Import from CSV/JSON
- Clone existing items
- Generate from patterns

## Resources

- View active sessions: \`huly://wizards/sessions\`
- Browse wizard catalog: \`huly://wizards/catalog\`
- Check statistics: \`huly://wizards/statistics\`

## Support

For additional help, check the project documentation or submit an issue.
`;

  return {
    contents: [
      {
        uri: 'huly://wizards/help',
        mimeType: 'text/markdown',
        text: helpContent
      }
    ]
  };
}

// Helper functions

function calculateAverageCompletionTime(sessions) {
  const completedSessions = sessions.filter(s => s.isCompleted);
  if (completedSessions.length === 0) return 0;

  const totalTime = completedSessions.reduce((sum, session) => {
    const startTime = new Date(session.metadata.startTime);
    const endTime = new Date(session.metadata.lastActivity);
    return sum + (endTime - startTime);
  }, 0);

  return Math.round(totalTime / completedSessions.length / 1000 / 60); // Minutes
}

function getMostUsedWizards(sessions) {
  const wizardCounts = {};

  sessions.forEach(session => {
    const wizardName = session.wizardDefinition.name;
    wizardCounts[wizardName] = (wizardCounts[wizardName] || 0) + 1;
  });

  return Object.entries(wizardCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

function calculateCompletionRates(sessions) {
  const wizardStats = {};

  sessions.forEach(session => {
    const wizardName = session.wizardDefinition.name;
    if (!wizardStats[wizardName]) {
      wizardStats[wizardName] = { total: 0, completed: 0 };
    }
    wizardStats[wizardName].total++;
    if (session.isCompleted) {
      wizardStats[wizardName].completed++;
    }
  });

  const rates = {};
  Object.entries(wizardStats).forEach(([wizard, stats]) => {
    rates[wizard] = stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;
  });

  return rates;
}

function getRecentActivity(sessions) {
  return sessions
    .sort((a, b) =>
      new Date(b.metadata.lastActivity) - new Date(a.metadata.lastActivity)
    )
    .slice(0, 10)
    .map(session => ({
      sessionId: session.id,
      wizard: session.wizardDefinition.name,
      step: session.getCurrentStep().name,
      lastActivity: session.metadata.lastActivity,
      status: session.isCompleted ? 'completed' : session.isAborted ? 'aborted' : 'active'
    }));
}

/**
 * Register resources function expected by the resource loader
 */
export async function registerResources() {
  const { registerResource } = await import('../../handlers/resources.js');

  // Register each wizard resource individually
  registerResource({
    uri: 'huly://wizards/sessions',
    name: 'sessions',
    title: 'Active Wizard Sessions',
    description: 'List of all active wizard sessions with their current states',
    mimeType: 'application/json',
    handler: getActiveSessionsResource,
    annotations: {
      category: 'wizards'
    }
  });

  registerResource({
    uri: 'huly://wizards/catalog',
    name: 'catalog',
    title: 'Wizard Catalog',
    description: 'Available wizards and their capabilities',
    mimeType: 'application/json',
    handler: getWizardCatalogResource,
    annotations: {
      category: 'wizards'
    }
  });

  registerResource({
    uri: 'huly://wizards/statistics',
    name: 'statistics',
    title: 'Wizard Statistics',
    description: 'Usage statistics and performance metrics for wizards',
    mimeType: 'application/json',
    handler: getWizardStatisticsResource,
    annotations: {
      category: 'wizards'
    }
  });

  registerResource({
    uri: 'huly://wizards/help',
    name: 'help',
    title: 'Wizard Help Guide',
    description: 'Interactive help and documentation for using wizards',
    mimeType: 'text/markdown',
    handler: getWizardHelpResource,
    annotations: {
      category: 'wizards'
    }
  });

  // Register dynamic resource template for individual sessions
  const { registerResourceTemplate } = await import('../../handlers/resources.js');
  registerResourceTemplate({
    uriTemplate: 'huly://wizards/session/{sessionId}',
    name: 'wizard_session',
    title: 'Wizard Session State',
    description: 'Individual wizard session state and progress',
    mimeType: 'application/json',
    handler: getSessionResource
  });

  logger.info('Wizard resources registered successfully');
}

export default registerWizardResources;