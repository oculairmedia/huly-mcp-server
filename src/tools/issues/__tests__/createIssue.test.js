/**
 * Unit tests for createIssue validation function
 */

import { describe, it, expect } from '@jest/globals';
import { validate } from '../createIssue.js';

describe('createIssue validation', () => {
  describe('project_identifier validation', () => {
    it('should return error when project_identifier is missing', () => {
      const result = validate({ title: 'Issue Title' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
    });

    it('should return error when project_identifier is empty string', () => {
      const result = validate({ project_identifier: '', title: 'Issue Title' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
    });

    it('should return error when project_identifier is only whitespace', () => {
      const result = validate({ project_identifier: '   ', title: 'Issue Title' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
    });

    it('should accept valid project_identifier', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title' });
      expect(result).toBeNull();
    });
  });

  describe('title validation', () => {
    it('should return error when title is missing', () => {
      const result = validate({ project_identifier: 'LMP' });
      expect(result).toHaveProperty('title', 'Issue title is required');
    });

    it('should return error when title is empty string', () => {
      const result = validate({ project_identifier: 'LMP', title: '' });
      expect(result).toHaveProperty('title', 'Issue title is required');
    });

    it('should return error when title is only whitespace', () => {
      const result = validate({ project_identifier: 'LMP', title: '   ' });
      expect(result).toHaveProperty('title', 'Issue title is required');
    });

    it('should accept valid title', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Fix critical bug' });
      expect(result).toBeNull();
    });
  });

  describe('priority validation', () => {
    it('should accept missing priority (optional field)', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title' });
      expect(result).toBeNull();
    });

    it('should accept valid priority: low', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title', priority: 'low' });
      expect(result).toBeNull();
    });

    it('should accept valid priority: medium', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title', priority: 'medium' });
      expect(result).toBeNull();
    });

    it('should accept valid priority: high', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title', priority: 'high' });
      expect(result).toBeNull();
    });

    it('should accept valid priority: urgent', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title', priority: 'urgent' });
      expect(result).toBeNull();
    });

    it('should return error for invalid priority', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title', priority: 'critical' });
      expect(result).toHaveProperty('priority', 'Priority must be one of: low, medium, high, urgent');
    });

    it('should return error for uppercase priority', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title', priority: 'HIGH' });
      expect(result).toHaveProperty('priority', 'Priority must be one of: low, medium, high, urgent');
    });

    it('should return error for numeric priority', () => {
      const result = validate({ project_identifier: 'LMP', title: 'Issue Title', priority: '1' });
      expect(result).toHaveProperty('priority', 'Priority must be one of: low, medium, high, urgent');
    });
  });

  describe('multiple validation errors', () => {
    it('should return multiple errors when multiple fields are invalid', () => {
      const result = validate({ priority: 'invalid' });
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
      expect(result).toHaveProperty('title', 'Issue title is required');
      expect(result).toHaveProperty('priority');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('should return both required field errors', () => {
      const result = validate({});
      expect(result).toHaveProperty('project_identifier', 'Project identifier is required');
      expect(result).toHaveProperty('title', 'Issue title is required');
      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('valid input combinations', () => {
    it('should accept minimal valid input', () => {
      const result = validate({
        project_identifier: 'LMP',
        title: 'Bug fix'
      });
      expect(result).toBeNull();
    });

    it('should accept complete valid input', () => {
      const result = validate({
        project_identifier: 'LMP',
        title: 'Implement new feature',
        description: 'Detailed description of the feature',
        priority: 'high'
      });
      expect(result).toBeNull();
    });

    it('should ignore unknown fields', () => {
      const result = validate({
        project_identifier: 'LMP',
        title: 'Issue title',
        unknownField: 'value'
      });
      expect(result).toBeNull();
    });

    it('should handle description field (no validation)', () => {
      const result = validate({
        project_identifier: 'LMP',
        title: 'Issue title',
        description: ''  // Empty description is allowed
      });
      expect(result).toBeNull();
    });
  });
});