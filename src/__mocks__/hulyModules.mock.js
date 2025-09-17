/**
 * Comprehensive Huly Module Mocks
 *
 * This file provides consistent mocking for all @hcengineering modules
 * used throughout the application. It ensures API consistency and catches
 * import mismatches early.
 */

import { jest } from '@jest/globals';

/**
 * @hcengineering/tracker module mock
 * Used for issue, project, component, and milestone management
 */
export const trackerMock = {
  default: {
    class: {
      Project: 'tracker:class:Project',
      Issue: 'tracker:class:Issue',
      Component: 'tracker:class:Component',
      Milestone: 'tracker:class:Milestone',
      IssueStatus: 'tracker:class:IssueStatus',
      IssueTemplate: 'tracker:class:IssueTemplate',
    },
    ids: {
      NoParent: 'tracker:ids:NoParent',
    },
    taskTypes: {
      Issue: 'tracker:taskType:Issue',
    },
    component: {
      Priority: {
        NoPriority: 0,
        Urgent: 1,
        High: 2,
        Medium: 3,
        Low: 4,
      },
    },
  },
};

/**
 * @hcengineering/core module mock
 * Used for base classes and spaces
 */
export const coreMock = {
  default: {
    class: {
      Space: 'core:class:Space',
      Account: 'core:class:Account',
      Doc: 'core:class:Doc',
      AttachedDoc: 'core:class:AttachedDoc',
    },
    space: {
      Model: 'core:space:Model',
      Space: 'core:space:Space',
    },
  },
};

/**
 * @hcengineering/contact module mock
 * Used for person and employee management
 */
export const contactMock = {
  contactPlugin: {
    class: {
      PersonAccount: 'contact:class:PersonAccount',
      Person: 'contact:class:Person',
      Contact: 'contact:class:Contact',
    },
    mixin: {
      Employee: 'contact:mixin:Employee',
    },
  },
};

/**
 * @hcengineering/chunter module mock
 * Used for comments and chat messages
 */
export const chunterMock = {
  default: {
    class: {
      ChatMessage: 'chunter:class:ChatMessage',
      Comment: 'chunter:class:Comment',
    },
  },
};

/**
 * @hcengineering/activity module mock
 * Used for activity tracking
 */
export const activityMock = {
  default: {
    class: {
      DocUpdateMessage: 'activity:class:DocUpdateMessage',
      ActivityMessage: 'activity:class:ActivityMessage',
    },
  },
};

/**
 * @hcengineering/task module mock
 * Used for task management
 */
export const taskMock = {
  default: {
    class: {
      Task: 'task:class:Task',
      Project: 'task:class:Project',
    },
  },
};

/**
 * Apply all module mocks to Jest
 * Call this function in test setup files or individual test files
 */
export function setupHulyModuleMocks() {
  // Mock all Huly modules
  jest.mock('@hcengineering/tracker', () => trackerMock);
  jest.mock('@hcengineering/core', () => coreMock);
  jest.mock('@hcengineering/contact', () => contactMock);
  jest.mock('@hcengineering/chunter', () => chunterMock);
  jest.mock('@hcengineering/activity', () => activityMock);
  jest.mock('@hcengineering/task', () => taskMock);

  // Mock the logger to prevent console spam in tests
  jest.mock('../utils/Logger.js', () => ({
    getLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  }));

  // Mock the text extractor utilities
  jest.mock('../utils/textExtractor.js', () => ({
    extractTextFromMarkup: jest.fn().mockImplementation(async (markup) => {
      if (typeof markup === 'string') return markup;
      if (markup && markup.content) return markup.content;
      return 'Mock extracted text';
    }),
    extractTextFromDoc: jest.fn().mockImplementation((doc) => {
      if (typeof doc === 'string') return doc;
      if (doc && doc.text) return doc.text;
      return 'Mock extracted doc text';
    }),
  }));

  // Mock URL generator
  jest.mock('../utils/urlGenerator.js', () => ({
    urlGenerator: {
      getIssueUrl: jest.fn().mockImplementation((projectId, issueId) => {
        if (!projectId || !issueId) return null;
        return `https://pm.oculair.ca/workbench/agentspace/tracker/${issueId}`;
      }),
      getProjectUrl: jest.fn().mockImplementation((projectId) => {
        if (!projectId) return null;
        return `https://pm.oculair.ca/workbench/agentspace/tracker/project/${projectId}`;
      }),
    },
  }));
}

/**
 * Validation helper to ensure mock integrity
 * Checks that all expected classes and IDs are present
 */
export function validateMockIntegrity() {
  const errors = [];

  // Check tracker mock
  const requiredTrackerClasses = ['Project', 'Issue', 'Component', 'Milestone', 'IssueStatus'];
  requiredTrackerClasses.forEach((className) => {
    if (!trackerMock.default.class[className]) {
      errors.push(`Missing tracker class: ${className}`);
    }
  });

  // Check core mock
  const requiredCoreClasses = ['Space', 'Account', 'Doc'];
  requiredCoreClasses.forEach((className) => {
    if (!coreMock.default.class[className]) {
      errors.push(`Missing core class: ${className}`);
    }
  });

  // Check contact mock
  const requiredContactClasses = ['Person', 'PersonAccount'];
  requiredContactClasses.forEach((className) => {
    if (!contactMock.contactPlugin.class[className]) {
      errors.push(`Missing contact class: ${className}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Mock integrity validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

// Export individual mocks for flexibility
export {
  trackerMock as tracker,
  coreMock as core,
  contactMock as contact,
  chunterMock as chunter,
  activityMock as activity,
  taskMock as task,
};

// Export convenience object with all mocks
export const allMocks = {
  tracker: trackerMock,
  core: coreMock,
  contact: contactMock,
  chunter: chunterMock,
  activity: activityMock,
  task: taskMock,
};
