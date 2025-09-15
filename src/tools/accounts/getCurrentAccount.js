/**
 * Get Current Account Tool
 *
 * Retrieves current user account information including workspace details,
 * role, and permissions for the authenticated user.
 */

import { createErrorResponse } from '../base/ToolInterface.js';
import { accountService } from '../../services/AccountService.js';

/**
 * Tool definition
 */
export const definition = {
  name: 'huly_get_current_account',
  description:
    "Get current user account information including workspace and role details. Retrieves comprehensive account information for the authenticated user, including email, name, role, confirmation status, workspace details, and session information. This tool provides essential identity and context information for understanding the current user's profile and permissions within the Huly system.",
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * Tool handler
 */
export async function handler(_args, context) {
  const { client, logger, services: _services } = context;

  try {
    logger.debug('Getting current account information');

    // Use AccountService to get current account
    const result = await accountService.getCurrentAccount(client);

    // Enhance with additional workspace and session information
    const enhancedResult = await enhanceAccountInfo(client, result, logger);

    return enhancedResult;
  } catch (error) {
    logger.error('Failed to get current account', { error });
    return createErrorResponse(
      'GET_CURRENT_ACCOUNT_FAILED',
      `Failed to get current account: ${error.message}`
    );
  }
}

/**
 * Enhance account information with workspace and session details
 * @private
 */
async function enhanceAccountInfo(client, accountResult, logger) {
  try {
    // Extract the account text from the service result
    const accountText = accountResult.content[0].text;

    // Get additional workspace information
    let workspaceInfo = '';
    try {
      // Try to get workspace information
      // Note: This may need adjustment based on how workspace info is available in client
      const workspaceId = client.getWorkspaceId?.() || client.workspace?.id || 'current';
      workspaceInfo = `\n**Workspace ID**: ${workspaceId}\n`;

      // Get workspace name if available
      const workspaceName = client.getWorkspaceName?.() || client.workspace?.name;
      if (workspaceName) {
        workspaceInfo += `**Workspace Name**: ${workspaceName}\n`;
      }

      // Get workspace URL if available
      const workspaceUrl = client.getWorkspaceUrl?.() || client.workspace?.url;
      if (workspaceUrl) {
        workspaceInfo += `**Workspace URL**: ${workspaceUrl}\n`;
      }
    } catch (error) {
      logger.debug('Failed to get workspace information', { error });
      workspaceInfo = '\n**Workspace**: Information not available\n';
    }

    // Get permission/role information
    let permissionInfo = '';
    try {
      // Get current user permissions if available
      const permissions = client.getPermissions?.() || [];
      if (permissions.length > 0) {
        permissionInfo += `\n## Permissions:\n${permissions.map((p) => `- ${p}`).join('\n')}\n`;
      }

      // Get user capabilities if available
      const capabilities = client.getCapabilities?.() || [];
      if (capabilities.length > 0) {
        permissionInfo += `\n## Capabilities:\n${capabilities.map((c) => `- ${c}`).join('\n')}\n`;
      }
    } catch (error) {
      logger.debug('Permission information not available', { error });
    }

    // Get session information
    let sessionInfo = '';
    try {
      const currentTime = new Date().toISOString();
      sessionInfo += `\n## Session Information:\n`;
      sessionInfo += `**Current Time**: ${currentTime}\n`;

      // Get connection status
      const isConnected = client.isConnected?.() ?? true;
      sessionInfo += `**Connection Status**: ${isConnected ? '✅ Connected' : '❌ Disconnected'}\n`;

      // Get session duration if available
      const sessionStart = client.getSessionStart?.();
      if (sessionStart) {
        const duration = Math.round((new Date() - new Date(sessionStart)) / 1000);
        sessionInfo += `**Session Duration**: ${duration} seconds\n`;
      }
    } catch (error) {
      logger.debug('Session information not available', { error });
    }

    // Combine all information
    const enhancedText = accountText + workspaceInfo + permissionInfo + sessionInfo;

    return {
      content: [
        {
          type: 'text',
          text: enhancedText,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to enhance account information', { error });
    // Return original result if enhancement fails
    return accountResult;
  }
}

/**
 * Validation function
 */
export function validate(args) {
  // No validation needed since no parameters required
  return { valid: true };
}
