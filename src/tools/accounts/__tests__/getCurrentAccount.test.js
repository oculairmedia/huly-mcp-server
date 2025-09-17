/**
 * Unit tests for Get Current Account Tool
 */

import { jest } from '@jest/globals';

// Create mock functions
const mockGetCurrentAccount = jest.fn();
const mockCreateErrorResponse = jest.fn((code, message) => ({
  content: [{ type: 'text', text: `Error ${code}: ${message}` }],
}));

// Mock AccountService using unstable_mockModule for ES modules
jest.unstable_mockModule('../../../services/AccountService.js', () => ({
  AccountService: jest.fn(),
  accountService: {
    getCurrentAccount: mockGetCurrentAccount,
  },
}));

// Mock ToolInterface using unstable_mockModule for ES modules
jest.unstable_mockModule('../../base/ToolInterface.js', () => ({
  createErrorResponse: mockCreateErrorResponse,
}));

// Import after mocking
const { definition, handler, validate } = await import('../getCurrentAccount.js');

describe('GetCurrentAccountTool', () => {
  let mockClient;
  let mockLogger;
  let mockServices;
  let mockContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockGetCurrentAccount.mockReset();

    // Create mock client
    mockClient = {
      getWorkspaceId: jest.fn(),
      getWorkspaceName: jest.fn(),
      getWorkspaceUrl: jest.fn(),
      getPermissions: jest.fn(),
      getCapabilities: jest.fn(),
      isConnected: jest.fn(),
      getSessionStart: jest.fn(),
      workspace: {
        id: 'test-workspace-id',
        name: 'Test Workspace',
        url: 'https://test.workspace.com',
      },
    };

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock services
    mockServices = {};

    // Create mock context
    mockContext = {
      client: mockClient,
      logger: mockLogger,
      services: mockServices,
    };
  });

  describe('definition', () => {
    it('should have correct tool definition', () => {
      expect(definition).toEqual({
        name: 'huly_get_current_account',
        description: expect.stringContaining('Get current user account information'),
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      });
    });
  });

  describe('validate', () => {
    it('should validate successfully with no arguments', () => {
      const result = validate({});
      expect(result).toEqual({ valid: true });
    });

    it('should validate successfully with any arguments', () => {
      const result = validate({ someArg: 'value' });
      expect(result).toEqual({ valid: true });
    });
  });

  describe('handler', () => {
    it('should get current account successfully', async () => {
      // Mock AccountService response
      const mockAccountResult = {
        content: [
          {
            type: 'text',
            text: '# Account: test@example.com\n\n**Account ID**: test-id\n**Email**: test@example.com\n**Name**: John Doe\n**Role**: user\n**Confirmed**: Yes',
          },
        ],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      // Setup client methods
      mockClient.getWorkspaceId.mockReturnValue('workspace-123');
      mockClient.getWorkspaceName.mockReturnValue('My Workspace');
      mockClient.getWorkspaceUrl.mockReturnValue('https://my.workspace.com');
      mockClient.isConnected.mockReturnValue(true);

      const result = await handler({}, mockContext);

      expect(mockGetCurrentAccount).toHaveBeenCalledWith(mockClient);
      expect(result.content[0].text).toContain('test@example.com');
      expect(result.content[0].text).toContain('**Workspace ID**: workspace-123');
      expect(result.content[0].text).toContain('**Workspace Name**: My Workspace');
      expect(result.content[0].text).toContain('**Workspace URL**: https://my.workspace.com');
      expect(result.content[0].text).toContain('**Connection Status**: ✅ Connected');
    });

    it('should handle workspace information from client.workspace object', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      // Don't mock the methods, use the workspace object
      mockClient.getWorkspaceId = undefined;
      mockClient.getWorkspaceName = undefined;
      mockClient.getWorkspaceUrl = undefined;

      const result = await handler({}, mockContext);

      expect(result.content[0].text).toContain('**Workspace ID**: test-workspace-id');
      expect(result.content[0].text).toContain('**Workspace Name**: Test Workspace');
      expect(result.content[0].text).toContain('**Workspace URL**: https://test.workspace.com');
    });

    it('should include permissions when available', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      mockClient.getPermissions.mockReturnValue(['read:issues', 'write:issues', 'admin:projects']);
      mockClient.getCapabilities.mockReturnValue(['create_issues', 'delete_projects']);

      const result = await handler({}, mockContext);

      expect(result.content[0].text).toContain('## Permissions:');
      expect(result.content[0].text).toContain('- read:issues');
      expect(result.content[0].text).toContain('- write:issues');
      expect(result.content[0].text).toContain('- admin:projects');
      expect(result.content[0].text).toContain('## Capabilities:');
      expect(result.content[0].text).toContain('- create_issues');
      expect(result.content[0].text).toContain('- delete_projects');
    });

    it('should include session duration when available', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      const sessionStart = new Date(Date.now() - 300000); // 5 minutes ago
      mockClient.getSessionStart.mockReturnValue(sessionStart.toISOString());
      mockClient.isConnected.mockReturnValue(true);

      const result = await handler({}, mockContext);

      expect(result.content[0].text).toContain('## Session Information:');
      expect(result.content[0].text).toContain('**Session Duration**: 300 seconds');
      expect(result.content[0].text).toContain('**Connection Status**: ✅ Connected');
    });

    it('should handle disconnected client', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      mockClient.isConnected.mockReturnValue(false);

      const result = await handler({}, mockContext);

      expect(result.content[0].text).toContain('**Connection Status**: ❌ Disconnected');
    });

    it('should handle missing workspace information gracefully', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      // Remove workspace object and mock methods to return undefined
      mockClient.workspace = undefined;
      mockClient.getWorkspaceId = jest.fn().mockReturnValue(undefined);
      mockClient.getWorkspaceName = jest.fn().mockReturnValue(undefined);
      mockClient.getWorkspaceUrl = jest.fn().mockReturnValue(undefined);

      const result = await handler({}, mockContext);

      expect(result.content[0].text).toContain('**Workspace ID**: current');
      expect(result.content[0].text).not.toContain('**Workspace Name**:');
      expect(result.content[0].text).not.toContain('**Workspace URL**:');
    });

    it('should handle workspace information errors gracefully', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      // Make workspace methods throw errors
      mockClient.getWorkspaceId = jest.fn().mockImplementation(() => {
        throw new Error('Workspace access denied');
      });
      mockClient.workspace = undefined;

      const result = await handler({}, mockContext);

      expect(result.content[0].text).toContain('**Workspace**: Information not available');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Failed to get workspace information',
        expect.any(Object)
      );
    });

    it('should handle enhancement errors and return original result', async () => {
      // Return a result that will cause enhancement to fail
      const corruptedResult = { content: null }; // This will cause content[0] to fail
      mockGetCurrentAccount.mockResolvedValue(corruptedResult);

      const result = await handler({}, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to enhance account information',
        expect.any(Object)
      );
      expect(result).toEqual(corruptedResult);
    });

    it('should handle AccountService errors', async () => {
      const error = new Error('Account service failed');
      mockGetCurrentAccount.mockRejectedValue(error);

      const _result = await handler({}, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get current account', {
        error,
      });
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        'GET_CURRENT_ACCOUNT_FAILED',
        'Failed to get current account: Account service failed'
      );
    });

    it('should handle empty permissions and capabilities', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      mockClient.getPermissions.mockReturnValue([]);
      mockClient.getCapabilities.mockReturnValue([]);

      const result = await handler({}, mockContext);

      expect(result.content[0].text).not.toContain('## Permissions:');
      expect(result.content[0].text).not.toContain('## Capabilities:');
    });

    it('should include current time in session information', async () => {
      const mockAccountResult = {
        content: [{ type: 'text', text: '# Account: test@example.com' }],
      };
      mockGetCurrentAccount.mockResolvedValue(mockAccountResult);

      const result = await handler({}, mockContext);

      expect(result.content[0].text).toContain('## Session Information:');
      expect(result.content[0].text).toContain('**Current Time**:');
      expect(result.content[0].text).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp pattern
    });
  });
});
