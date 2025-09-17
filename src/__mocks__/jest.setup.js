/**
 * Jest Setup for Huly MCP Server Tests
 *
 * This file is automatically loaded by Jest before running tests.
 * It sets up all necessary mocks and global test configuration.
 */

import { jest, beforeEach } from '@jest/globals';

// Apply comprehensive Huly module mocks
jest.mock('@hcengineering/tracker', () => ({
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
}));

jest.mock('@hcengineering/core', () => ({
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
}));

jest.mock('@hcengineering/contact', () => ({
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
}));

jest.mock('@hcengineering/chunter', () => ({
  default: {
    class: {
      ChatMessage: 'chunter:class:ChatMessage',
      Comment: 'chunter:class:Comment',
    },
  },
}));

jest.mock('@hcengineering/activity', () => ({
  default: {
    class: {
      DocUpdateMessage: 'activity:class:DocUpdateMessage',
      ActivityMessage: 'activity:class:ActivityMessage',
    },
  },
}));

jest.mock('@hcengineering/task', () => ({
  default: {
    class: {
      Task: 'task:class:Task',
      Project: 'task:class:Project',
    },
  },
}));

// Mock utility modules
jest.mock('../utils/Logger.js', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

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

// Mock ProjectService for wizard tests
jest.mock('../services/ProjectService.js', () => ({
  ProjectService: class MockProjectService {
    constructor(client) {
      this.client = client;
    }

    async createProject(data) {
      return {
        id: 'mock-project-id',
        identifier: data.identifier,
        name: data.name,
        description: data.description,
        private: data.private || false,
        archived: false,
        owners: data.owners || [],
        members: data.members || [],
      };
    }

    async listProjects() {
      return [];
    }
  },
}));

// Global test configuration
beforeEach(() => {
  // Clear all mocks before each test to prevent interference
  jest.clearAllMocks();
});

// Set longer timeout for integration tests
jest.setTimeout(10000);

// Suppress console warnings in tests unless explicitly needed
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  // Only show warnings for specific test-related issues
  if (args[0] && args[0].includes('ExperimentalWarning')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};
