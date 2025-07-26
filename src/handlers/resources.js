/**
 * MCP Resource Handler for Huly MCP Server
 * Based on Letta MCP Server patterns for resource management
 */

import { createLoggerWithConfig } from '../utils/index.js';
import { getConfigManager } from '../config/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  ListResourceTemplatesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Initialize logger
const configManager = getConfigManager();
const logger = createLoggerWithConfig(configManager).child('resources');

// Registry to store available resources
const resourceRegistry = new Map();
const resourceTemplates = new Map();
const subscriptions = new Map(); // uri -> Set of client ids

// Store context for resource handlers
let resourceContext = null;

/**
 * Register resource handlers with the MCP server
 * @param {Object} server - The MCP server instance
 * @param {Object} context - Context with client and services
 */
export function registerResourceHandlers(server, context = null) {
  // Store context for resource handlers
  if (context) {
    resourceContext = context;
  }
  logger.info('Registering MCP resource handlers');

  // Handler for resources/list
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    logger.info('Handling resources/list request', { params: request.params });

    try {
      const resources = Array.from(resourceRegistry.values());
      const cursor = request.params?.cursor;
      const pageSize = 50;

      // Simple pagination
      let startIndex = 0;
      if (cursor) {
        startIndex = parseInt(cursor, 10) || 0;
      }

      const paginatedResources = resources.slice(startIndex, startIndex + pageSize);
      const hasMore = startIndex + pageSize < resources.length;

      return {
        resources: paginatedResources.map((r) => ({
          uri: r.uri,
          name: r.name,
          title: r.title,
          description: r.description,
          mimeType: r.mimeType,
          ...(r.size && { size: r.size }),
          ...(r.annotations && { annotations: r.annotations }),
        })),
        ...(hasMore && { nextCursor: String(startIndex + pageSize) }),
      };
    } catch (error) {
      logger.error('Error listing resources', { error: error.message });
      throw error;
    }
  });

  // Handler for resources/read
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    logger.info('Handling resources/read request', { params: request.params });

    const { uri } = request.params || {};

    if (!uri) {
      throw new Error('Missing required parameter: uri');
    }

    const resource = resourceRegistry.get(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    try {
      // Get the resource content with client wrapper pattern
      const { hulyClientWrapper } = resourceContext;
      const content = await hulyClientWrapper.withClient(async (client) => {
        const context = {
          ...resourceContext,
          client,
        };
        return resource.handler(context);
      });

      return {
        contents: [
          {
            uri: resource.uri,
            name: resource.name,
            title: resource.title,
            mimeType: resource.mimeType,
            ...content, // text or blob
            ...(resource.annotations && { annotations: resource.annotations }),
          },
        ],
      };
    } catch (error) {
      logger.error('Error reading resource', { uri, error: error.message });
      throw error;
    }
  });

  // Handler for resources/subscribe
  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    logger.info('Handling resources/subscribe request', { params: request.params });

    const { uri } = request.params || {};

    if (!uri) {
      throw new Error('Missing required parameter: uri');
    }

    const resource = resourceRegistry.get(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    // Add subscription (simplified - in real implementation would track client)
    if (!subscriptions.has(uri)) {
      subscriptions.set(uri, new Set());
    }
    subscriptions.get(uri).add('client'); // Placeholder client ID

    return {}; // Empty response for successful subscription
  });

  // Handler for resources/templates/list
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    logger.info('Handling resources/templates/list request');

    try {
      const templates = Array.from(resourceTemplates.values());

      return {
        resourceTemplates: templates.map((t) => ({
          uriTemplate: t.uriTemplate,
          name: t.name,
          title: t.title,
          description: t.description,
          mimeType: t.mimeType,
        })),
      };
    } catch (error) {
      logger.error('Error listing resource templates', { error: error.message });
      throw error;
    }
  });
}

/**
 * Register a new resource
 * @param {Object} resource - Resource definition
 * @param {string} resource.uri - Unique resource URI
 * @param {string} resource.name - Resource name
 * @param {string} resource.title - Human-readable title
 * @param {string} resource.description - Resource description
 * @param {string} resource.mimeType - MIME type
 * @param {Function} resource.handler - Function that returns resource content
 * @param {Object} resource.annotations - Optional annotations
 */
export function registerResource(resource) {
  if (!resource.uri || !resource.handler) {
    throw new Error('Resource must have uri and handler');
  }

  logger.info('Registering resource', { uri: resource.uri });
  resourceRegistry.set(resource.uri, resource);
}

/**
 * Register a resource template
 * @param {Object} template - Resource template definition
 */
export function registerResourceTemplate(template) {
  if (!template.uriTemplate || !template.name) {
    throw new Error('Resource template must have uriTemplate and name');
  }

  logger.info('Registering resource template', { name: template.name });
  resourceTemplates.set(template.name, template);
}

/**
 * Emit resource list changed notification
 * @param {Object} server - The MCP server instance
 */
export function notifyResourcesChanged(server) {
  if (server.sendNotification) {
    server.sendNotification({
      method: 'notifications/resources/list_changed',
    });
  }
}

/**
 * Emit resource updated notification
 * @param {Object} server - The MCP server instance
 * @param {string} uri - Resource URI
 */
export function notifyResourceUpdated(server, uri) {
  const resource = resourceRegistry.get(uri);
  if (resource && server.sendNotification) {
    server.sendNotification({
      method: 'notifications/resources/updated',
      params: {
        uri: resource.uri,
        title: resource.title,
      },
    });
  }
}

/**
 * Get resource registry statistics
 */
export function getResourceStats() {
  return {
    totalResources: resourceRegistry.size,
    totalTemplates: resourceTemplates.size,
    totalSubscriptions: subscriptions.size,
  };
}
