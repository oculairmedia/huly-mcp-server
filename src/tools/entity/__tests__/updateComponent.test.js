/**
 * Tests for component update functionality in huly_entity tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { handler, validate } from '../hulyEntity.js';

describe('huly_entity - component update', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = {
      client: {
        findOne: jest.fn(),
        updateDoc: jest.fn(),
      },
      services: {
        projectService: {
          findProject: jest.fn(),
          updateComponent: jest.fn(),
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
        entity_type: 'component',
        operation: 'update',
        entity_identifier: 'Frontend',
        data: { label: 'UI' },
      };

      const errors = validate(args);
      expect(errors).toBeTruthy();
      expect(errors.project_identifier).toBeTruthy();
    });

    it('should require entity_identifier for update', () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        data: { label: 'UI' },
      };

      const errors = validate(args);
      expect(errors).toBeTruthy();
      expect(errors.entity_identifier).toBeTruthy();
    });

    it('should require data for update', () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Frontend',
      };

      const errors = validate(args);
      expect(errors).toBeTruthy();
      expect(errors.data).toBeTruthy();
    });

    it('should require at least one field in update data', () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Frontend',
        data: {},
      };

      const errors = validate(args);
      expect(errors).toBeTruthy();
      expect(errors.data).toContain('At least one');
    });

    it('should accept valid update with label only', () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Frontend',
        data: { label: 'UI Layer' },
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should accept valid update with description only', () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Frontend',
        data: { description: 'Updated description' },
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });

    it('should accept valid update with both fields', () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Frontend',
        data: {
          label: 'UI Layer',
          description: 'Updated description',
        },
      };

      const errors = validate(args);
      expect(errors).toBeNull();
    });
  });

  describe('handler', () => {
    it('should call projectService.updateComponent with label only', async () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Frontend',
        data: { label: 'UI Layer' },
      };

      mockContext.services.projectService.updateComponent.mockResolvedValue({
        content: [{ type: 'text', text: 'Updated component' }],
      });

      const result = await handler(args, mockContext);

      expect(mockContext.services.projectService.updateComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Frontend',
        'UI Layer',
        undefined
      );
      expect(result.content[0].text).toContain('Updated');
    });

    it('should call projectService.updateComponent with description only', async () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Backend',
        data: { description: 'New description' },
      };

      mockContext.services.projectService.updateComponent.mockResolvedValue({
        content: [{ type: 'text', text: 'Updated description' }],
      });

      const result = await handler(args, mockContext);

      expect(mockContext.services.projectService.updateComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'Backend',
        undefined,
        'New description'
      );
      expect(result.content[0].text).toBeTruthy();
    });

    it('should call projectService.updateComponent with both fields', async () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'API',
        data: {
          label: 'Backend API',
          description: 'REST API layer',
        },
      };

      mockContext.services.projectService.updateComponent.mockResolvedValue({
        content: [{ type: 'text', text: 'Updated both' }],
      });

      const result = await handler(args, mockContext);

      expect(mockContext.services.projectService.updateComponent).toHaveBeenCalledWith(
        mockContext.client,
        'PROJ',
        'API',
        'Backend API',
        'REST API layer'
      );
      expect(result.content[0].text).toBeTruthy();
    });

    it('should handle component not found error', async () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'NonExistent',
        data: { label: 'New' },
      };

      const error = new Error('Component "NonExistent" not found');
      mockContext.services.projectService.updateComponent.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('not found');
    });

    it('should handle duplicate label error', async () => {
      const args = {
        entity_type: 'component',
        operation: 'update',
        project_identifier: 'PROJ',
        entity_identifier: 'Frontend',
        data: { label: 'Backend' },
      };

      const error = new Error('Component with label "Backend" already exists');
      mockContext.services.projectService.updateComponent.mockRejectedValue(error);

      const result = await handler(args, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('already exists');
    });
  });
});
