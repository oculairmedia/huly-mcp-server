/**
 * Constants Tests
 *
 * Tests for core constants and configurations
 */

import { describe, test, expect } from '@jest/globals';
import {
  ERROR_CODES,
  PRIORITY_MAP,
  PRIORITY_NAMES,
  MILESTONE_STATUS_MAP,
  MILESTONE_STATUS_NAMES,
  DEFAULTS,
  VALIDATION_PATTERNS,
  VALID_UPDATE_FIELDS,
  MCP_PROTOCOL,
  SERVER_INFO
} from '../../../src/core/constants.js';

describe('Constants Tests', () => {
  describe('ERROR_CODES', () => {
    test('should have all required error codes', () => {
      const requiredCodes = [
        'ISSUE_NOT_FOUND',
        'PROJECT_NOT_FOUND',
        'COMPONENT_NOT_FOUND',
        'MILESTONE_NOT_FOUND',
        'COMMENT_NOT_FOUND',
        'REPOSITORY_NOT_FOUND',
        'INVALID_FIELD',
        'INVALID_VALUE',
        'VALIDATION_ERROR',
        'DATABASE_ERROR',
        'CONNECTION_ERROR',
        'PERMISSION_ERROR',
        'UNKNOWN_ERROR'
      ];

      requiredCodes.forEach(code => {
        expect(ERROR_CODES).toHaveProperty(code);
        expect(ERROR_CODES[code]).toBe(code);
      });
    });

    test('should have unique error code values', () => {
      const values = Object.values(ERROR_CODES);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('Priority mappings', () => {
    test('PRIORITY_MAP should have correct mappings', () => {
      expect(PRIORITY_MAP).toEqual({
        'NoPriority': 0,
        'urgent': 1,
        'high': 2,
        'medium': 3,
        'low': 4
      });
    });

    test('PRIORITY_NAMES should match map values', () => {
      expect(PRIORITY_NAMES).toEqual(['NoPriority', 'Urgent', 'High', 'Medium', 'Low']);
      expect(PRIORITY_NAMES).toHaveLength(5);
    });

    test('priority values should be sequential', () => {
      const values = Object.values(PRIORITY_MAP).sort((a, b) => a - b);
      expect(values).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('Milestone status mappings', () => {
    test('MILESTONE_STATUS_MAP should have correct mappings', () => {
      expect(MILESTONE_STATUS_MAP).toEqual({
        'planned': 0,
        'in_progress': 1,
        'completed': 2,
        'canceled': 3
      });
    });

    test('MILESTONE_STATUS_NAMES should match map values', () => {
      expect(MILESTONE_STATUS_NAMES).toEqual(['Planned', 'In Progress', 'Completed', 'Canceled']);
      expect(MILESTONE_STATUS_NAMES).toHaveLength(4);
    });
  });

  describe('DEFAULTS', () => {
    test('should have all required default values', () => {
      expect(DEFAULTS.ISSUE_LIMIT).toBe(50);
      expect(DEFAULTS.COMMENT_LIMIT).toBe(50);
      expect(DEFAULTS.SEARCH_LIMIT).toBe(50);
      expect(DEFAULTS.DESCRIPTION_TRUNCATE_LENGTH).toBe(200);
      expect(DEFAULTS.DEFAULT_PRIORITY).toBe('medium');
      expect(DEFAULTS.DEFAULT_MILESTONE_STATUS).toBe('planned');
    });

    test('limit values should be positive', () => {
      expect(DEFAULTS.ISSUE_LIMIT).toBeGreaterThan(0);
      expect(DEFAULTS.COMMENT_LIMIT).toBeGreaterThan(0);
      expect(DEFAULTS.SEARCH_LIMIT).toBeGreaterThan(0);
      expect(DEFAULTS.DESCRIPTION_TRUNCATE_LENGTH).toBeGreaterThan(0);
    });
  });

  describe('VALIDATION_PATTERNS', () => {
    test('PROJECT_IDENTIFIER should validate correctly', () => {
      const pattern = VALIDATION_PATTERNS.PROJECT_IDENTIFIER;

      // Valid identifiers
      expect('A'.match(pattern)).toBeTruthy();
      expect('AB'.match(pattern)).toBeTruthy();
      expect('ABC'.match(pattern)).toBeTruthy();
      expect('ABCD'.match(pattern)).toBeTruthy();
      expect('ABCDE'.match(pattern)).toBeTruthy();

      // Invalid identifiers
      expect(''.match(pattern)).toBeFalsy();
      expect('ABCDEF'.match(pattern)).toBeFalsy(); // Too long
      expect('abc'.match(pattern)).toBeFalsy(); // Lowercase
      expect('AB1'.match(pattern)).toBeFalsy(); // Contains number
      expect('A-B'.match(pattern)).toBeFalsy(); // Contains hyphen
    });

    test('ISSUE_IDENTIFIER should validate correctly', () => {
      const pattern = VALIDATION_PATTERNS.ISSUE_IDENTIFIER;

      // Valid identifiers
      expect('A-1'.match(pattern)).toBeTruthy();
      expect('ABC-123'.match(pattern)).toBeTruthy();
      expect('PROJ-9999'.match(pattern)).toBeTruthy();

      // Invalid identifiers
      expect('ABC'.match(pattern)).toBeFalsy(); // No number
      expect('123'.match(pattern)).toBeFalsy(); // No project
      expect('abc-123'.match(pattern)).toBeFalsy(); // Lowercase
      expect('ABC-'.match(pattern)).toBeFalsy(); // No number after hyphen
      expect('ABC_123'.match(pattern)).toBeFalsy(); // Underscore instead of hyphen
    });

    test('ISO_DATE should validate correctly', () => {
      const pattern = VALIDATION_PATTERNS.ISO_DATE;

      // Valid dates
      expect('2024-01-15'.match(pattern)).toBeTruthy();
      expect('2024-12-31T23:59:59'.match(pattern)).toBeTruthy();
      expect('2024-01-01T00:00:00.000'.match(pattern)).toBeTruthy();
      expect('2024-01-01T00:00:00Z'.match(pattern)).toBeTruthy();
      expect('2024-01-01T00:00:00.000Z'.match(pattern)).toBeTruthy();

      // Invalid dates
      expect('2024-1-1'.match(pattern)).toBeFalsy(); // Single digit month/day
      expect('01-15-2024'.match(pattern)).toBeFalsy(); // Wrong format
      expect('2024/01/15'.match(pattern)).toBeFalsy(); // Wrong separator
      expect('2024-13-01'.match(pattern)).toBeTruthy(); // Note: pattern doesn't validate actual date validity
    });
  });

  describe('VALID_UPDATE_FIELDS', () => {
    test('should contain all updateable fields', () => {
      expect(VALID_UPDATE_FIELDS).toEqual([
        'title',
        'description',
        'status',
        'priority',
        'component',
        'milestone'
      ]);
    });

    test('should not contain system fields', () => {
      expect(VALID_UPDATE_FIELDS).not.toContain('_id');
      expect(VALID_UPDATE_FIELDS).not.toContain('createdOn');
      expect(VALID_UPDATE_FIELDS).not.toContain('modifiedOn');
      expect(VALID_UPDATE_FIELDS).not.toContain('number');
      expect(VALID_UPDATE_FIELDS).not.toContain('identifier');
    });
  });

  describe('MCP_PROTOCOL', () => {
    test('should have valid protocol version', () => {
      expect(MCP_PROTOCOL.VERSION).toBe('2024-11-05');
      expect(MCP_PROTOCOL.JSON_RPC_VERSION).toBe('2.0');
    });
  });

  describe('SERVER_INFO', () => {
    test('should have correct server information', () => {
      expect(SERVER_INFO.name).toBe('huly-mcp-server');
      expect(SERVER_INFO.version).toBe('1.0.0');
      expect(SERVER_INFO.description).toBe('MCP server for Huly project management platform');
    });
  });

  describe('Constant relationships', () => {
    test('priority map keys should be lowercase except NoPriority', () => {
      Object.keys(PRIORITY_MAP).forEach(key => {
        if (key !== 'NoPriority') {
          expect(key).toBe(key.toLowerCase());
        }
      });
    });

    test('milestone status map keys should use underscores', () => {
      Object.keys(MILESTONE_STATUS_MAP).forEach(key => {
        expect(key).toMatch(/^[a-z_]+$/);
      });
    });
  });
});