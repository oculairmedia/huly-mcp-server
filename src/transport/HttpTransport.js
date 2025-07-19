/**
 * HttpTransport - HTTP transport for MCP
 *
 * Implements MCP communication over HTTP using Express
 */

import express from 'express';
import cors from 'cors';
import { BaseTransport } from './BaseTransport.js';
import { HulyError } from '../core/index.js';

export class HttpTransport extends BaseTransport {
  constructor(server, options = {}) {
    super(server);
    this.port = options.port || process.env.PORT || 3000;
    this.app = null;
    this.httpServer = null;
    this.running = false;
    this.toolDefinitions = options.toolDefinitions || [];
    this.hulyClientWrapper = options.hulyClientWrapper;
    this.services = options.services || {};
  }

  /**
   * Start the HTTP transport
   * @returns {Promise<void>}
   */
  async start() {
    if (this.running) {
      throw new Error('HTTP transport is already running');
    }

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    this.setupRoutes();

    return new Promise((resolve, reject) => {
      this.httpServer = this.app.listen(this.port, () => {
        this.running = true;
        console.log(`HTTP transport started on port ${this.port}`);
        console.log(`Health check: http://localhost:${this.port}/health`);
        console.log(`MCP endpoint: http://localhost:${this.port}/mcp`);
        console.log(`Tools endpoint: http://localhost:${this.port}/tools`);
        resolve();
      });

      this.httpServer.on('error', (error) => {
        this.running = false;
        reject(new Error(`Failed to start HTTP transport: ${error.message}`));
      });
    });
  }

  /**
   * Stop the HTTP transport
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.running) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (this.httpServer) {
        this.httpServer.close((error) => {
          if (error) {
            reject(new Error(`Failed to stop HTTP transport: ${error.message}`));
          } else {
            this.running = false;
            this.httpServer = null;
            this.app = null;
            console.log('HTTP transport stopped');
            resolve();
          }
        });
      } else {
        this.running = false;
        resolve();
      }
    });
  }

  /**
   * Get the transport type
   * @returns {string}
   */
  getType() {
    return 'http';
  }

  /**
   * Check if transport is running
   * @returns {boolean}
   */
  isRunning() {
    return this.running;
  }

  /**
   * Set up HTTP routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'huly-mcp-server',
        transport: 'http',
        uptime: process.uptime(),
      });
    });

    // MCP JSON-RPC endpoint
    this.app.post('/mcp', async (req, res) => {
      try {
        const { jsonrpc, method, params, id } = req.body;

        // Validate JSON-RPC request
        if (jsonrpc !== '2.0' || !method) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: id || null,
          });
        }

        let result;

        switch (method) {
          case 'initialize':
            result = {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'huly-mcp-server',
                version: '1.0.0',
              },
            };
            break;

          case 'tools/list':
            result = {
              tools: this.toolDefinitions,
            };
            break;

          case 'tools/call':
            result = await this.executeTool(params.name, params.arguments);
            break;

          default:
            return res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32601, message: 'Method not found', data: { method } },
              id,
            });
        }

        res.json({
          jsonrpc: '2.0',
          result,
          id,
        });
      } catch (error) {
        this.handleError(res, error, req.body.id);
      }
    });

    // REST-style tools endpoint
    this.app.get('/tools', (req, res) => {
      res.json({ tools: this.toolDefinitions });
    });

    // REST-style tool execution endpoint
    this.app.post('/tools/:toolName', async (req, res) => {
      try {
        const { toolName } = req.params;
        const result = await this.executeTool(toolName, req.body);
        res.json(result);
      } catch (error) {
        this.handleError(res, error);
      }
    });
  }

  /**
   * Execute a tool by delegating to services
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, args) {
    // Delegate to the services
    return this.hulyClientWrapper.withClient(async (client) => {
      const { projectService, issueService } = this.services;

      switch (toolName) {
        // Project tools
        case 'huly_list_projects':
          return projectService.listProjects(client);
        case 'huly_create_project':
          return projectService.createProject(client, args.name, args.description, args.identifier);
        case 'huly_list_components':
          return projectService.listComponents(client, args.project_identifier);
        case 'huly_create_component':
          return projectService.createComponent(
            client,
            args.project_identifier,
            args.label,
            args.description
          );
        case 'huly_list_milestones':
          return projectService.listMilestones(client, args.project_identifier);
        case 'huly_create_milestone':
          return projectService.createMilestone(
            client,
            args.project_identifier,
            args.label,
            args.description,
            args.target_date,
            args.status
          );
        case 'huly_list_github_repositories':
          return projectService.listGithubRepositories(client);
        case 'huly_assign_repository_to_project':
          return projectService.assignRepositoryToProject(
            client,
            args.project_identifier,
            args.repository_name
          );

        // Issue tools
        case 'huly_list_issues':
          return issueService.listIssues(client, args.project_identifier, args.limit);
        case 'huly_create_issue':
          return issueService.createIssue(
            client,
            args.project_identifier,
            args.title,
            args.description,
            args.priority
          );
        case 'huly_update_issue':
          return issueService.updateIssue(client, args.issue_identifier, args.field, args.value);
        case 'huly_create_subissue':
          return issueService.createSubissue(
            client,
            args.parent_issue_identifier,
            args.title,
            args.description,
            args.priority
          );
        case 'huly_search_issues':
          return issueService.searchIssues(client, args);
        case 'huly_list_comments':
          return issueService.listComments(client, args.issue_identifier, args.limit);
        case 'huly_create_comment':
          return issueService.createComment(client, args.issue_identifier, args.message);
        case 'huly_get_issue_details':
          return issueService.getIssueDetails(client, args.issue_identifier);

        default:
          throw HulyError.invalidValue('tool', toolName, 'a valid tool name');
      }
    });
  }

  /**
   * Handle errors and send appropriate responses
   * @param {Object} res - Express response object
   * @param {Error} error - Error to handle
   * @param {*} id - Request ID for JSON-RPC
   */
  handleError(res, error, id = null) {
    if (error instanceof HulyError) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message,
          data: {
            errorCode: error.code,
            details: error.details,
          },
        },
        id,
      });
    } else {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: error.message },
        id,
      });
    }
  }
}
