/**
 * Tests for validation utilities
 */

import {
  isValidProjectIdentifier,
  isValidIssueIdentifier,
  parseIssueIdentifier,
  isValidPriority,
  getValidPriorities,
  normalizePriority,
  isValidUpdateField,
  isValidISODate,
  isValidMilestoneStatus,
  validateRequiredString,
  validateOptionalString,
  validateEnum,
  validatePositiveInteger,
  sanitizeString,
  createIdentifierValidator,
  validateProjectIdentifier,
  validateIssueIdentifier,
} from '../validators.js';
import { HulyError } from '../../core/HulyError.js';

describe('Validation Utilities', () => {
  describe('isValidProjectIdentifier', () => {
    it('should validate correct project identifiers', () => {
      expect(isValidProjectIdentifier('ABC')).toBe(true);
      expect(isValidProjectIdentifier('A1B2C')).toBe(true);
      expect(isValidProjectIdentifier('TEST')).toBe(true);
      expect(isValidProjectIdentifier('X')).toBe(true);
      expect(isValidProjectIdentifier('12345')).toBe(true);
    });

    it('should reject invalid project identifiers', () => {
      expect(isValidProjectIdentifier('')).toBe(false);
      expect(isValidProjectIdentifier(null)).toBe(false);
      expect(isValidProjectIdentifier(undefined)).toBe(false);
      expect(isValidProjectIdentifier('abc')).toBe(false); // lowercase
      expect(isValidProjectIdentifier('TOOLONG')).toBe(false); // > 5 chars
      expect(isValidProjectIdentifier('A-B')).toBe(false); // contains hyphen
      expect(isValidProjectIdentifier('A B')).toBe(false); // contains space
      expect(isValidProjectIdentifier(123)).toBe(false); // not a string
    });
  });

  describe('isValidIssueIdentifier', () => {
    it('should validate correct issue identifiers', () => {
      expect(isValidIssueIdentifier('ABC-1')).toBe(true);
      expect(isValidIssueIdentifier('TEST-123')).toBe(true);
      expect(isValidIssueIdentifier('X-9999')).toBe(true);
      expect(isValidIssueIdentifier('12345-1')).toBe(true);
    });

    it('should reject invalid issue identifiers', () => {
      expect(isValidIssueIdentifier('')).toBe(false);
      expect(isValidIssueIdentifier(null)).toBe(false);
      expect(isValidIssueIdentifier('ABC')).toBe(false); // no number
      expect(isValidIssueIdentifier('ABC-')).toBe(false); // no number after dash
      expect(isValidIssueIdentifier('abc-1')).toBe(false); // lowercase
      expect(isValidIssueIdentifier('TOOLONG-1')).toBe(false); // project part too long
    });
  });

  describe('parseIssueIdentifier', () => {
    it('should parse valid issue identifiers', () => {
      expect(parseIssueIdentifier('ABC-123')).toEqual({
        project: 'ABC',
        number: 123,
      });
      expect(parseIssueIdentifier('X-1')).toEqual({
        project: 'X',
        number: 1,
      });
    });

    it('should return null for invalid identifiers', () => {
      expect(parseIssueIdentifier('invalid')).toBe(null);
      expect(parseIssueIdentifier('')).toBe(null);
      expect(parseIssueIdentifier(null)).toBe(null);
    });
  });

  describe('isValidPriority', () => {
    it('should validate correct priorities', () => {
      expect(isValidPriority('low')).toBe(true);
      expect(isValidPriority('medium')).toBe(true);
      expect(isValidPriority('high')).toBe(true);
      expect(isValidPriority('urgent')).toBe(true);
      expect(isValidPriority('NoPriority')).toBe(true);
    });

    it('should reject invalid priorities', () => {
      expect(isValidPriority('')).toBe(false);
      expect(isValidPriority(null)).toBe(false);
      expect(isValidPriority('Low')).toBe(false); // case sensitive
      expect(isValidPriority('critical')).toBe(false);
      expect(isValidPriority('none')).toBe(false);
    });
  });

  describe('getValidPriorities', () => {
    it('should return all valid priorities', () => {
      const priorities = getValidPriorities();
      expect(priorities).toContain('low');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('high');
      expect(priorities).toContain('urgent');
      expect(priorities).toContain('NoPriority');
    });
  });

  describe('normalizePriority', () => {
    it('should normalize priority values', () => {
      expect(normalizePriority('Low')).toBe('low');
      expect(normalizePriority('MEDIUM')).toBe('medium');
      expect(normalizePriority('nopriority')).toBe('NoPriority');
      expect(normalizePriority('no-priority')).toBe('NoPriority');
      expect(normalizePriority('none')).toBe('NoPriority');
    });

    it('should return null for invalid priorities', () => {
      expect(normalizePriority('')).toBe(null);
      expect(normalizePriority(null)).toBe(null);
      expect(normalizePriority('invalid')).toBe(null);
      expect(normalizePriority(123)).toBe(null);
    });
  });

  describe('isValidUpdateField', () => {
    it('should validate correct update fields', () => {
      expect(isValidUpdateField('title')).toBe(true);
      expect(isValidUpdateField('description')).toBe(true);
      expect(isValidUpdateField('status')).toBe(true);
      expect(isValidUpdateField('priority')).toBe(true);
      expect(isValidUpdateField('component')).toBe(true);
      expect(isValidUpdateField('milestone')).toBe(true);
    });

    it('should reject invalid update fields', () => {
      expect(isValidUpdateField('')).toBe(false);
      expect(isValidUpdateField(null)).toBe(false);
      expect(isValidUpdateField('invalid')).toBe(false);
      expect(isValidUpdateField('Title')).toBe(false); // case sensitive
    });
  });

  describe('isValidISODate', () => {
    it('should validate correct ISO dates', () => {
      expect(isValidISODate('2024-01-15T10:30:00.000Z')).toBe(true);
      expect(isValidISODate('2024-12-31')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidISODate('')).toBe(false);
      expect(isValidISODate(null)).toBe(false);
      expect(isValidISODate('2024-13-01')).toBe(false); // invalid month
      expect(isValidISODate('2024/01/15')).toBe(false); // wrong format
      expect(isValidISODate('not a date')).toBe(false);
    });
  });

  describe('isValidMilestoneStatus', () => {
    it('should validate correct milestone statuses', () => {
      expect(isValidMilestoneStatus('planned')).toBe(true);
      expect(isValidMilestoneStatus('in_progress')).toBe(true);
      expect(isValidMilestoneStatus('completed')).toBe(true);
      expect(isValidMilestoneStatus('canceled')).toBe(true);
    });

    it('should reject invalid milestone statuses', () => {
      expect(isValidMilestoneStatus('pending')).toBe(false);
      expect(isValidMilestoneStatus('done')).toBe(false);
      expect(isValidMilestoneStatus('')).toBe(false);
    });
  });

  describe('validateRequiredString', () => {
    it('should validate and trim valid strings', () => {
      expect(validateRequiredString('test', 'field')).toBe('test');
      expect(validateRequiredString('  test  ', 'field')).toBe('test');
    });

    it('should throw for missing values', () => {
      expect(() => validateRequiredString('', 'field')).toThrow(HulyError);
      expect(() => validateRequiredString(null, 'field')).toThrow(HulyError);
      expect(() => validateRequiredString(undefined, 'field')).toThrow(HulyError);
      expect(() => validateRequiredString('   ', 'field')).toThrow(HulyError);
    });

    it('should validate length constraints', () => {
      expect(validateRequiredString('test', 'field', { minLength: 3 })).toBe('test');
      expect(() => validateRequiredString('ab', 'field', { minLength: 3 })).toThrow(HulyError);

      expect(validateRequiredString('test', 'field', { maxLength: 5 })).toBe('test');
      expect(() => validateRequiredString('toolong', 'field', { maxLength: 5 })).toThrow(HulyError);
    });

    it('should validate pattern', () => {
      expect(validateRequiredString('ABC', 'field', { pattern: /^[A-Z]+$/ })).toBe('ABC');
      expect(() => validateRequiredString('abc', 'field', { pattern: /^[A-Z]+$/ })).toThrow(
        HulyError
      );
    });
  });

  describe('validateOptionalString', () => {
    it('should return undefined for empty values', () => {
      expect(validateOptionalString(undefined, 'field')).toBe(undefined);
      expect(validateOptionalString(null, 'field')).toBe(undefined);
      expect(validateOptionalString('', 'field')).toBe(undefined);
    });

    it('should validate non-empty strings', () => {
      expect(validateOptionalString('test', 'field')).toBe('test');
      expect(validateOptionalString('  test  ', 'field')).toBe('test');
    });
  });

  describe('validateEnum', () => {
    const validValues = ['option1', 'option2', 'option3'];

    it('should validate enum values', () => {
      expect(validateEnum('option1', 'field', validValues)).toBe('option1');
      expect(validateEnum('option2', 'field', validValues)).toBe('option2');
    });

    it('should use default value when provided', () => {
      expect(validateEnum(undefined, 'field', validValues, 'option1')).toBe('option1');
      expect(validateEnum(null, 'field', validValues, 'option2')).toBe('option2');
    });

    it('should throw for invalid values', () => {
      expect(() => validateEnum('invalid', 'field', validValues)).toThrow(HulyError);
      expect(() => validateEnum(undefined, 'field', validValues)).toThrow(HulyError);
    });
  });

  describe('validatePositiveInteger', () => {
    it('should validate positive integers', () => {
      expect(validatePositiveInteger(0, 'field')).toBe(0);
      expect(validatePositiveInteger(42, 'field')).toBe(42);
      expect(validatePositiveInteger('123', 'field')).toBe(123);
    });

    it('should use default value when provided', () => {
      expect(validatePositiveInteger(undefined, 'field', { defaultValue: 10 })).toBe(10);
      expect(validatePositiveInteger(null, 'field', { defaultValue: 20 })).toBe(20);
    });

    it('should validate min/max constraints', () => {
      expect(validatePositiveInteger(5, 'field', { min: 1, max: 10 })).toBe(5);
      expect(() => validatePositiveInteger(0, 'field', { min: 1 })).toThrow(HulyError);
      expect(() => validatePositiveInteger(15, 'field', { max: 10 })).toThrow(HulyError);
    });

    it('should throw for negative or non-integer values', () => {
      expect(() => validatePositiveInteger(-1, 'field')).toThrow(HulyError);
      expect(() => validatePositiveInteger(3.14, 'field')).toThrow(HulyError);
      expect(() => validatePositiveInteger('abc', 'field')).toThrow(HulyError);
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize strings', () => {
      expect(sanitizeString('normal text')).toBe('normal text');
      expect(sanitizeString('  spaces  ')).toBe('spaces');
      expect(sanitizeString('text\x00with\x1Fcontrol')).toBe('textwithcontrol');
    });

    it('should handle invalid inputs', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });
  });

  describe('createIdentifierValidator', () => {
    const validator = createIdentifierValidator({
      validator: (id) => id === 'valid',
      entityName: 'test',
    });

    it('should create working validators', () => {
      expect(validator('valid')).toBe('valid');
    });

    it('should throw appropriate errors', () => {
      expect(() => validator('')).toThrow(HulyError);
      expect(() => validator('invalid')).toThrow(HulyError);
    });
  });

  describe('Pre-configured validators', () => {
    it('validateProjectIdentifier should work correctly', () => {
      expect(validateProjectIdentifier('ABC')).toBe('ABC');
      expect(() => validateProjectIdentifier('abc')).toThrow(HulyError);
      expect(() => validateProjectIdentifier('')).toThrow(HulyError);
    });

    it('validateIssueIdentifier should work correctly', () => {
      expect(validateIssueIdentifier('ABC-123')).toBe('ABC-123');
      expect(() => validateIssueIdentifier('invalid')).toThrow(HulyError);
      expect(() => validateIssueIdentifier('')).toThrow(HulyError);
    });
  });
});
// Test ES modules config
