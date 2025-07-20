/**
 * Unit tests for createMilestone validation function
 */

import { describe, it, expect } from '@jest/globals';
import { validate } from '../createMilestone.js';

describe('createMilestone validation', () => {
  describe('project_identifier validation', () => {
    it('should return error when project_identifier is missing', () => {
      const result = validate({ label: 'v1.0', target_date: '2024-12-31' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
    });

    it('should return error when project_identifier is empty string', () => {
      const result = validate({ project_identifier: '', label: 'v1.0', target_date: '2024-12-31' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
    });

    it('should return error when project_identifier is only whitespace', () => {
      const result = validate({ project_identifier: '   ', label: 'v1.0', target_date: '2024-12-31' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
    });

    it('should accept valid project_identifier', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31' });
      expect(result).toBeNull();
    });
  });

  describe('label validation', () => {
    it('should return error when label is missing', () => {
      const result = validate({ project_identifier: 'WEBHOOK', target_date: '2024-12-31' });
      expect(result).toHaveProperty('label', 'Milestone label is required');
    });

    it('should return error when label is empty string', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: '', target_date: '2024-12-31' });
      expect(result).toHaveProperty('label', 'Milestone label is required');
    });

    it('should return error when label is only whitespace', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: '   ', target_date: '2024-12-31' });
      expect(result).toHaveProperty('label', 'Milestone label is required');
    });

    it('should accept valid label', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'Release v1.0', target_date: '2024-12-31' });
      expect(result).toBeNull();
    });
  });

  describe('target_date validation', () => {
    it('should return error when target_date is missing', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0' });
      expect(result).toHaveProperty('target_date', 'Target date is required');
    });

    it('should return error when target_date is empty string', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '' });
      expect(result).toHaveProperty('target_date', 'Target date is required');
    });

    it('should return error when target_date is only whitespace', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '   ' });
      expect(result).toHaveProperty('target_date', 'Target date is required');
    });

    it('should accept valid date format: YYYY-MM-DD', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31' });
      expect(result).toBeNull();
    });

    it('should accept valid date format: full ISO 8601', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31T23:59:59Z' });
      expect(result).toBeNull();
    });

    it('should accept valid date format: ISO 8601 with milliseconds', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31T23:59:59.999Z' });
      expect(result).toBeNull();
    });

    it('should return error for invalid date format', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '12/31/2024' });
      expect(result).toHaveProperty('target_date', 'Target date must be in ISO 8601 format (e.g., "2024-12-31" or "2024-12-31T23:59:59Z")');
    });

    it('should return error for incomplete date', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12' });
      expect(result).toHaveProperty('target_date', 'Target date must be in ISO 8601 format (e.g., "2024-12-31" or "2024-12-31T23:59:59Z")');
    });

    it('should return error for invalid date values', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-13-45' });
      expect(result).toHaveProperty('target_date', 'Invalid date');
    });

    it('should accept valid leap year date', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-02-29' });
      expect(result).toBeNull();
    });

    it('should return error for text instead of date', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-32' });
      expect(result).toHaveProperty('target_date', 'Invalid date');
    });
  });

  describe('status validation', () => {
    it('should accept missing status (optional field)', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31' });
      expect(result).toBeNull();
    });

    it('should accept valid status: planned', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31', status: 'planned' });
      expect(result).toBeNull();
    });

    it('should accept valid status: in_progress', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31', status: 'in_progress' });
      expect(result).toBeNull();
    });

    it('should accept valid status: completed', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31', status: 'completed' });
      expect(result).toBeNull();
    });

    it('should accept valid status: canceled', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31', status: 'canceled' });
      expect(result).toBeNull();
    });

    it('should return error for invalid status', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31', status: 'done' });
      expect(result).toHaveProperty('status', 'Status must be one of: planned, in_progress, completed, canceled');
    });

    it('should return error for uppercase status', () => {
      const result = validate({ project_identifier: 'WEBHOOK', label: 'v1.0', target_date: '2024-12-31', status: 'PLANNED' });
      expect(result).toHaveProperty('status', 'Status must be one of: planned, in_progress, completed, canceled');
    });
  });

  describe('multiple validation errors', () => {
    it('should return all required field errors', () => {
      const result = validate({});
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
      expect(result).toHaveProperty('label', 'Milestone label is required');
      expect(result).toHaveProperty('target_date', 'Target date is required');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('should return multiple errors including invalid optional fields', () => {
      const result = validate({ target_date: 'invalid-date', status: 'invalid' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
      expect(result).toHaveProperty('label', 'Milestone label is required');
      expect(result).toHaveProperty('target_date');
      expect(result).toHaveProperty('status');
      expect(Object.keys(result)).toHaveLength(4);
    });
  });

  describe('valid input combinations', () => {
    it('should accept minimal valid input', () => {
      const result = validate({
        project_identifier: 'WEBHOOK',
        label: 'Version 1.0',
        target_date: '2024-12-31'
      });
      expect(result).toBeNull();
    });

    it('should accept complete valid input', () => {
      const result = validate({
        project_identifier: 'WEBHOOK',
        label: 'Version 1.0',
        description: 'First major release',
        target_date: '2024-12-31T23:59:59Z',
        status: 'planned'
      });
      expect(result).toBeNull();
    });

    it('should ignore unknown fields', () => {
      const result = validate({
        project_identifier: 'WEBHOOK',
        label: 'Version 1.0',
        target_date: '2024-12-31',
        unknownField: 'value'
      });
      expect(result).toBeNull();
    });

    it('should handle description field (no validation)', () => {
      const result = validate({
        project_identifier: 'WEBHOOK',
        label: 'Version 1.0',
        target_date: '2024-12-31',
        description: ''  // Empty description is allowed
      });
      expect(result).toBeNull();
    });
  });
});