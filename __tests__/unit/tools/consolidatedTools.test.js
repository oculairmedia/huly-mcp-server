/**
 * Unit tests for consolidated Huly MCP tools
 */

import { jest } from '@jest/globals';
import { handler as entityHandler, definition as entityDefinition } from '../../../src/tools/entity/hulyEntity.js';
import { handler as queryHandler } from '../../../src/tools/query/hulyQuery.js';
import { handler as issueOpsHandler } from '../../../src/tools/issue_ops/hulyIssueOps.js';
import { handler as validateHandler } from '../../../src/tools/validate/hulyValidate.js';

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => createLogger()),
  };
}

describe('Consolidated MCP tools', () => {
  describe('huly_entity', () => {
    it('exports expected tool definition', () => {
      expect(entityDefinition.name).toBe('huly_entity');
      expect(entityDefinition.inputSchema).toBeDefined();
    });

    it('delegates project creation to ProjectService', async () => {
      const mockResponse = { content: [{ type: 'text', text: 'created' }] };
      const services = {
        projectService: {
          createProject: jest.fn().mockResolvedValue(mockResponse),
        },
        issueService: {},
      };
      const args = {
        entity_type: 'project',
        operation: 'create',
        data: {
          name: 'Consolidated',
          description: 'Test',
          identifier: 'CONS',
        },
      };
      const context = {
        client: {},
        services,
        logger: createLogger(),
      };

      const result = await entityHandler(args, context);

      expect(services.projectService.createProject).toHaveBeenCalledWith(
        {},
        'Consolidated',
        'Test',
        'CONS'
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('huly_query', () => {
    it('routes project list requests to ProjectService', async () => {
      const mockResponse = { content: [{ type: 'text', text: 'list' }] };
      const services = {
        projectService: {
          listProjects: jest.fn().mockResolvedValue(mockResponse),
        },
      };
      const context = {
        client: {},
        services,
        logger: createLogger(),
      };

      const result = await queryHandler(
        { entity_type: 'project', mode: 'list' },
        context
      );

      expect(services.projectService.listProjects).toHaveBeenCalledWith({});
      expect(result).toBe(mockResponse);
    });
  });

  describe('huly_issue_ops', () => {
    it('executes issue creation via IssueService', async () => {
      const mockResponse = { content: [{ type: 'text', text: 'issue created' }] };
      const services = {
        issueService: {
          createIssue: jest.fn().mockResolvedValue(mockResponse),
        },
      };
      const context = {
        client: {},
        services,
        logger: createLogger(),
      };
      const args = {
        operation: 'create',
        project_identifier: 'CONS',
        data: {
          title: 'Test Issue',
          description: 'Desc',
          priority: 'medium',
        },
      };

      const result = await issueOpsHandler(args, context);

      expect(services.issueService.createIssue).toHaveBeenCalledWith(
        {},
        'CONS',
        'Test Issue',
        'Desc',
        'medium',
        undefined,
        undefined
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('huly_validate', () => {
    it('validates issue deletion using DeletionService', async () => {
      const mockImpact = {
        issue: { title: 'Test Issue' },
        blockers: [],
        subIssues: [],
        comments: 0,
        attachments: 0,
      };
      const services = {
        deletionService: {
          analyzeIssueDeletionImpact: jest.fn().mockResolvedValue(mockImpact),
        },
      };
      const context = {
        client: {},
        services,
        logger: createLogger(),
      };

      const result = await validateHandler(
        {
          validation_type: 'deletion',
          entity_type: 'issue',
          entity_identifier: 'CONS-1',
        },
        context
      );

      expect(services.deletionService.analyzeIssueDeletionImpact).toHaveBeenCalledWith(
        {},
        'CONS-1'
      );
      expect(result.content).toBeDefined();
      const payload = JSON.parse(result.content[0].text);
      expect(payload.entity.identifier).toBe('CONS-1');
      expect(payload.success).toBe(true);
    });
  });
});
