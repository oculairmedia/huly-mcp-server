/**
 * Unit tests for createProject validation function
 */

import { describe, it, expect } from '@jest/globals';
import { validate } from '../createProject.js';

describe('createProject validation', () => {
  describe('name validation', () => {
    it('should return error when name is missing', () => {
      const result = validate({});
      expect(result).toHaveProperty('name', 'Project name is required');
    });

    it('should return error when name is empty string', () => {
      const result = validate({ name: '' });
      expect(result).toHaveProperty('name', 'Project name is required');
    });

    it('should return error when name is only whitespace', () => {
      const result = validate({ name: '   ' });
      expect(result).toHaveProperty('name', 'Project name is required');
    });

    it('should accept valid name', () => {
      const result = validate({ name: 'My Project' });
      expect(result).toBeNull();
    });
  });

  describe('identifier validation', () => {
    it('should accept missing identifier (optional field)', () => {
      const result = validate({ name: 'My Project' });
      expect(result).toBeNull();
    });

    it('should accept valid uppercase identifier', () => {
      const result = validate({ name: 'My Project', identifier: 'PROJ' });
      expect(result).toBeNull();
    });

    it('should accept single character identifier', () => {
      const result = validate({ name: 'My Project', identifier: 'P' });
      expect(result).toBeNull();
    });

    it('should accept identifier with numbers', () => {
      const result = validate({ name: 'My Project', identifier: 'PRJ01' });
      expect(result).toBeNull();
    });

    it('should return error when identifier is too long', () => {
      const result = validate({ name: 'My Project', identifier: 'TOOLONG' });
      expect(result).toHaveProperty('identifier', 'Project identifier must be 5 characters or less');
    });

    it('should return error when identifier has lowercase letters', () => {
      const result = validate({ name: 'My Project', identifier: 'Proj' });
      expect(result).toHaveProperty('identifier', 'Project identifier must contain only uppercase letters and numbers');
    });

    it('should return error when identifier has special characters', () => {
      const result = validate({ name: 'My Project', identifier: 'PR-J' });
      expect(result).toHaveProperty('identifier', 'Project identifier must contain only uppercase letters and numbers');
    });

    it('should return error when identifier has spaces', () => {
      const result = validate({ name: 'My Project', identifier: 'PR J' });
      expect(result).toHaveProperty('identifier', 'Project identifier must contain only uppercase letters and numbers');
    });
  });

  describe('multiple validation errors', () => {
    it('should return multiple errors when multiple fields are invalid', () => {
      const result = validate({ identifier: 'invalid-id' });
      expect(result).toHaveProperty('name', 'Project name is required');
      expect(result).toHaveProperty('identifier');
      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('valid input combinations', () => {
    it('should accept minimal valid input', () => {
      const result = validate({ name: 'Test Project' });
      expect(result).toBeNull();
    });

    it('should accept complete valid input', () => {
      const result = validate({
        name: 'Test Project',
        description: 'A test project description',
        identifier: 'TEST'
      });
      expect(result).toBeNull();
    });

    it('should ignore unknown fields', () => {
      const result = validate({
        name: 'Test Project',
        unknownField: 'value'
      });
      expect(result).toBeNull();
    });
  });
});