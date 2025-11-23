/**
 * Tests for project update functionality in huly_entity tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { handler, validate } from '../hulyEntity.js';

describe('huly_entity - project update', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = {
      client: {
        findOne: jest.fn(),
        update: jest.fn(),
      },
      services: {
        projectService: {
          findProject: jest.fn(),
          updateProject: jest.fn(),
        },
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
      },
    };
  });

  describe('validation', () => {
    it('should require project_identifier for update', () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        data: { name: 'New Name' },
      };

      const errors = validate(args);
      expect(errors).toBeTruthy();
      expect(errors.project_identifier).toBeTruthy();
    });

    it('should require data for update', () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
      };

      const errors = validate(args);
      expect(errors).toBeTruthy();
      expect(errors.data).toBeTruthy();
    });

    it('should require at least one field in update data', () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
        data: {},
      };

      const errors = validate(args);
      expect(errors).toBeTruthy();
      expect(errors.data).toContain('At least one');
    });

    it('should accept valid update with name only', () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
        data: { name: 'New Name' },
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should accept valid update with description only', () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
        data: { description: 'New Description' },
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should accept valid update with both fields', () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
        data: {
          name: 'New Name',
          description: 'New Description',
        },
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });
  });

  describe('handler', () => {
    it('should call projectService.updateProject with correct args', async () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
        data: {
          name: 'Updated Name',
          description: 'Updated Description',
        },
      };

      mockContext.services.projectService.updateProject.mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });

      await handler(args, mockContext);

      expect(mockContext.services.projectService.updateProject).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        {
          name: 'Updated Name',
          description: 'Updated Description',
        }
      );
    });

    it('should handle update with name only', async () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
        data: { name: 'Updated Name' },
      };

      mockContext.services.projectService.updateProject.mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });

      await handler(args, mockContext);

      expect(mockContext.services.projectService.updateProject).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        {
          name: 'Updated Name',
          description: undefined,
        }
      );
    });

    it('should handle update with description only', async () => {
      const args = {
        entity_type: 'project',
        operation: 'update',
        project_identifier: 'PROJ',
        data: { description: 'Updated Description' },
      };

      mockContext.services.projectService.updateProject.mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });

      await handler(args, mockContext);

      expect(mockContext.services.projectService.updateProject).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        {
          name: undefined,
          description: 'Updated Description',
        }
      );
    });
  });
});
