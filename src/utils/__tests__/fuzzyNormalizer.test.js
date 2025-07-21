/**
 * Tests for Fuzzy Normalizer Utilities
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  normalizeStatus,
  normalizePriority,
  fuzzyMatch,
  normalizeProjectIdentifier,
  normalizeLabel,
  normalizeDate,
  normalizeSearchQuery,
} from '../fuzzyNormalizer.js';

describe('fuzzyNormalizer', () => {
  describe('normalizeStatus', () => {
    it('should normalize common status variations', () => {
      // Backlog variations
      expect(normalizeStatus('backlog')).toBe('Backlog');
      expect(normalizeStatus('back log')).toBe('Backlog');
      expect(normalizeStatus('new')).toBe('Backlog');
      expect(normalizeStatus('open')).toBe('Backlog');

      // Todo variations
      expect(normalizeStatus('todo')).toBe('Todo');
      expect(normalizeStatus('to do')).toBe('Todo');
      expect(normalizeStatus('to-do')).toBe('Todo');
      expect(normalizeStatus('planned')).toBe('Todo');

      // In Progress variations
      expect(normalizeStatus('in progress')).toBe('In Progress');
      expect(normalizeStatus('inprogress')).toBe('In Progress');
      expect(normalizeStatus('in-progress')).toBe('In Progress');
      expect(normalizeStatus('wip')).toBe('In Progress');
      expect(normalizeStatus('working')).toBe('In Progress');

      // Done variations
      expect(normalizeStatus('done')).toBe('Done');
      expect(normalizeStatus('completed')).toBe('Done');
      expect(normalizeStatus('finished')).toBe('Done');
      expect(normalizeStatus('closed')).toBe('Done');

      // Canceled variations
      expect(normalizeStatus('canceled')).toBe('Canceled');
      expect(normalizeStatus('cancelled')).toBe('Canceled');
      expect(normalizeStatus('dropped')).toBe('Canceled');
      expect(normalizeStatus('wontfix')).toBe('Canceled');
    });

    it('should handle case and whitespace', () => {
      expect(normalizeStatus('  DONE  ')).toBe('Done');
      expect(normalizeStatus('IN PROGRESS')).toBe('In Progress');
      expect(normalizeStatus('ToDo')).toBe('Todo');
    });

    it('should return original value if no match', () => {
      expect(normalizeStatus('Custom Status')).toBe('Custom Status');
      expect(normalizeStatus('Unknown')).toBe('Unknown');
    });

    it('should handle null/undefined', () => {
      expect(normalizeStatus(null)).toBeNull();
      expect(normalizeStatus(undefined)).toBeUndefined();
      expect(normalizeStatus('')).toBe('');
    });
  });

  describe('normalizePriority', () => {
    it('should normalize common priority variations', () => {
      // No Priority variations
      expect(normalizePriority('nopriority')).toBe('NoPriority');
      expect(normalizePriority('no priority')).toBe('NoPriority');
      expect(normalizePriority('none')).toBe('NoPriority');
      expect(normalizePriority('null')).toBe('NoPriority');

      // Low variations
      expect(normalizePriority('low')).toBe('low');
      expect(normalizePriority('l')).toBe('low');
      expect(normalizePriority('minor')).toBe('low');
      expect(normalizePriority('1')).toBe('low');

      // Medium variations
      expect(normalizePriority('medium')).toBe('medium');
      expect(normalizePriority('med')).toBe('medium');
      expect(normalizePriority('normal')).toBe('medium');
      expect(normalizePriority('2')).toBe('medium');

      // High variations
      expect(normalizePriority('high')).toBe('high');
      expect(normalizePriority('h')).toBe('high');
      expect(normalizePriority('important')).toBe('high');
      expect(normalizePriority('3')).toBe('high');

      // Urgent variations
      expect(normalizePriority('urgent')).toBe('urgent');
      expect(normalizePriority('critical')).toBe('urgent');
      expect(normalizePriority('blocker')).toBe('urgent');
      expect(normalizePriority('4')).toBe('urgent');
    });

    it('should handle case and whitespace', () => {
      expect(normalizePriority('  HIGH  ')).toBe('high');
      expect(normalizePriority('URGENT')).toBe('urgent');
      expect(normalizePriority('No Priority')).toBe('NoPriority');
    });
  });

  describe('fuzzyMatch', () => {
    const testValues = ['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled'];

    it('should find exact matches', () => {
      expect(fuzzyMatch('Done', testValues)).toBe('Done');
      expect(fuzzyMatch('done', testValues)).toBe('Done');
      expect(fuzzyMatch('TODO', testValues)).toBe('Todo');
    });

    it('should find partial matches', () => {
      expect(fuzzyMatch('Prog', testValues)).toBe('In Progress');
      expect(fuzzyMatch('Back', testValues)).toBe('Backlog');
      expect(fuzzyMatch('Cancel', testValues)).toBe('Canceled');
    });

    it('should find fuzzy matches with typos', () => {
      // These have small typos and should match with reasonable threshold
      expect(fuzzyMatch('Doe', testValues, 0.5)).toBe('Done');
      expect(fuzzyMatch('Backlog', testValues, 0.5)).toBe('Backlog'); // exact match
      expect(fuzzyMatch('Progress', testValues, 0.5)).toBe('In Progress'); // contains match
    });

    it('should respect threshold', () => {
      expect(fuzzyMatch('xyz', testValues, 0.9)).toBeNull();
      // Single character 'D' matches multiple values, but we want no match with very high threshold
      expect(fuzzyMatch('zzz', testValues, 0.95)).toBeNull();
    });

    it('should handle edge cases', () => {
      expect(fuzzyMatch(null, testValues)).toBeNull();
      expect(fuzzyMatch('test', null)).toBeNull();
      expect(fuzzyMatch('test', [])).toBeNull();
    });
  });

  describe('normalizeProjectIdentifier', () => {
    const projects = [{ identifier: 'HULLY' }, { identifier: 'LMP' }, { identifier: 'TEST-123' }];

    it('should match case-insensitive', () => {
      expect(normalizeProjectIdentifier('hully', projects)).toBe('HULLY');
      expect(normalizeProjectIdentifier('Hully', projects)).toBe('HULLY');
      expect(normalizeProjectIdentifier('HULLY', projects)).toBe('HULLY');
      expect(normalizeProjectIdentifier('lmp', projects)).toBe('LMP');
    });

    it('should fuzzy match similar identifiers', () => {
      expect(normalizeProjectIdentifier('HULL', projects)).toBe('HULLY');
      expect(normalizeProjectIdentifier('TEST123', projects)).toBe('TEST-123');
    });

    it('should return original if no match', () => {
      expect(normalizeProjectIdentifier('UNKNOWN', projects)).toBe('UNKNOWN');
      expect(normalizeProjectIdentifier('XYZ', projects)).toBe('XYZ');
    });
  });

  describe('normalizeLabel', () => {
    const items = [
      { label: 'Backend Development' },
      { label: 'Frontend' },
      { name: 'Testing Framework' },
    ];

    it('should match case-insensitive', () => {
      expect(normalizeLabel('backend development', items)).toBe('Backend Development');
      expect(normalizeLabel('FRONTEND', items)).toBe('Frontend');
      expect(normalizeLabel('testing framework', items)).toBe('Testing Framework');
    });

    it('should fuzzy match similar labels', () => {
      expect(normalizeLabel('Backend', items)).toBe('Backend Development');
      expect(normalizeLabel('Front', items)).toBe('Frontend');
      expect(normalizeLabel('Testing', items)).toBe('Testing Framework');
    });

    it('should handle items with name instead of label', () => {
      expect(normalizeLabel('Testing Framework', items)).toBe('Testing Framework');
    });
  });

  describe('normalizeDate', () => {
    // Mock current date for consistent testing
    const mockDate = new Date('2024-01-15T12:00:00Z');
    const originalDate = Date;

    beforeEach(() => {
      globalThis.Date = jest.fn((dateString) => {
        if (dateString) {
          return new originalDate(dateString);
        }
        return mockDate;
      });
      globalThis.Date.now = originalDate.now;
      globalThis.Date.parse = originalDate.parse;
      globalThis.Date.UTC = originalDate.UTC;
    });

    afterEach(() => {
      globalThis.Date = originalDate;
    });

    it('should parse relative dates', () => {
      // Test that these return valid ISO strings (not testing exact values due to timezone)
      const today = normalizeDate('today');
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const yesterday = normalizeDate('yesterday');
      expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const lastWeek = normalizeDate('last week');
      expect(lastWeek).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should parse standard date formats', () => {
      // ISO date formats should parse correctly
      expect(normalizeDate('2024-01-01T10:30:00Z')).toBe('2024-01-01T10:30:00.000Z');

      // Other formats will vary by timezone, so just check they parse
      const parsed1 = normalizeDate('2024-01-01');
      expect(parsed1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const parsed2 = normalizeDate('Jan 1, 2024');
      expect(parsed2).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return null for invalid dates', () => {
      expect(normalizeDate('invalid')).toBeNull();
      expect(normalizeDate('not a date')).toBeNull();
      expect(normalizeDate('')).toBe('');
    });
  });

  describe('normalizeSearchQuery', () => {
    it('should clean and normalize queries', () => {
      expect(normalizeSearchQuery('  Test  Query  ')).toBe('test query');
      expect(normalizeSearchQuery('Test@#$Query')).toBe('testquery');
      expect(normalizeSearchQuery('Multiple   Spaces')).toBe('multiple spaces');
      expect(normalizeSearchQuery('hyphen-test_underscore')).toBe('hyphen-test_underscore');
    });

    it('should handle special characters', () => {
      expect(normalizeSearchQuery('test!@#$%^&*()')).toBe('test');
      expect(normalizeSearchQuery('test.query')).toBe('testquery');
      expect(normalizeSearchQuery('test?query')).toBe('testquery');
    });

    it('should handle edge cases', () => {
      expect(normalizeSearchQuery(null)).toBeNull();
      expect(normalizeSearchQuery(undefined)).toBeUndefined();
      expect(normalizeSearchQuery('')).toBe('');
      expect(normalizeSearchQuery('   ')).toBe('');
    });
  });
});
