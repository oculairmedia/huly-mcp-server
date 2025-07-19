/**
 * HulyError Tests
 *
 * Tests for the custom error handling class
 */

import { describe, test, expect } from '@jest/globals';
import { HulyError, ERROR_CODES } from '../../../src/core/HulyError.js';

describe('HulyError Tests', () => {
  describe('Constructor', () => {
    test('should create error with code and message', () => {
      const error = new HulyError('TEST_ERROR', 'Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HulyError);
      expect(error.name).toBe('HulyError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.details).toEqual({});
    });

    test('should create error with details', () => {
      const details = {
        context: 'Testing context',
        suggestion: 'Try something else',
        data: { field: 'test', value: 123 }
      };
      const error = new HulyError('DETAILED_ERROR', 'Error with details', details);

      expect(error.code).toBe('DETAILED_ERROR');
      expect(error.message).toBe('Error with details');
      expect(error.details).toEqual(details);
      expect(error.details.context).toBe('Testing context');
      expect(error.details.suggestion).toBe('Try something else');
      expect(error.details.data).toEqual({ field: 'test', value: 123 });
    });

    test('should have proper error stack trace', () => {
      const error = new HulyError('STACK_ERROR', 'Stack trace test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('HulyError');
      expect(error.stack).toContain('Stack trace test');
    });

    test('should handle null/undefined details gracefully', () => {
      const error1 = new HulyError('NULL_DETAILS', 'Test', null);
      const error2 = new HulyError('UNDEF_DETAILS', 'Test', undefined);

      expect(error1.details).toEqual({});
      expect(error2.details).toEqual({});
    });
  });

  describe('toMCPResponse Method', () => {
    test('should format basic error response', () => {
      const error = new HulyError('BASIC_ERROR', 'Basic error message');
      const response = error.toMCPResponse();

      expect(response).toHaveProperty('content');
      expect(response.content).toBeInstanceOf(Array);
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: 'text',
        text: '❌ Error [BASIC_ERROR]: Basic error message'
      });
    });

    test('should include context in response', () => {
      const error = new HulyError('CONTEXT_ERROR', 'Error with context', {
        context: 'While processing user request'
      });
      const response = error.toMCPResponse();

      expect(response.content[0].text).toContain('❌ Error [CONTEXT_ERROR]: Error with context');
      expect(response.content[0].text).toContain('\n\nContext: While processing user request');
    });

    test('should include suggestion in response', () => {
      const error = new HulyError('SUGGESTION_ERROR', 'Error with suggestion', {
        suggestion: 'Please check your input format'
      });
      const response = error.toMCPResponse();

      expect(response.content[0].text).toContain('❌ Error [SUGGESTION_ERROR]: Error with suggestion');
      expect(response.content[0].text).toContain('\n\nSuggestion: Please check your input format');
    });

    test('should include both context and suggestion', () => {
      const error = new HulyError('FULL_ERROR', 'Complete error', {
        context: 'During API call',
        suggestion: 'Retry with valid credentials'
      });
      const response = error.toMCPResponse();

      const expectedText = '❌ Error [FULL_ERROR]: Complete error\n\nContext: During API call\n\nSuggestion: Retry with valid credentials';
      expect(response.content[0].text).toBe(expectedText);
    });
  });

  describe('Helper Methods', () => {
    test('formatErrorMessage should format correctly', () => {
      const error = new HulyError('FORMAT_TEST', 'Test formatting', {
        context: 'Test context',
        suggestion: 'Test suggestion'
      });

      const formatted = error.formatErrorMessage();
      expect(formatted).toContain('❌ Error [FORMAT_TEST]: Test formatting');
      expect(formatted).toContain('Context: Test context');
      expect(formatted).toContain('Suggestion: Test suggestion');
    });

    test('toJSON should serialize properly', () => {
      const error = new HulyError('JSON_TEST', 'JSON test', {
        data: { test: true }
      });

      const json = error.toJSON();
      expect(json).toHaveProperty('name', 'HulyError');
      expect(json).toHaveProperty('code', 'JSON_TEST');
      expect(json).toHaveProperty('message', 'JSON test');
      expect(json).toHaveProperty('details');
      expect(json).toHaveProperty('stack');
    });

    test('isType should check error type', () => {
      const error = new HulyError(ERROR_CODES.ISSUE_NOT_FOUND, 'Issue not found');

      expect(error.isType(ERROR_CODES.ISSUE_NOT_FOUND)).toBe(true);
      expect(error.isType(ERROR_CODES.PROJECT_NOT_FOUND)).toBe(false);
    });
  });

  describe('Static Factory Methods', () => {
    test('validation should create validation error', () => {
      const error = HulyError.validation('email', 'invalid@', 'Please provide a valid email');

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe("Validation failed for field 'email'");
      expect(error.details.context).toContain('invalid@');
      expect(error.details.suggestion).toBe('Please provide a valid email');
      expect(error.details.data).toEqual({ field: 'email', value: 'invalid@' });
    });

    test('notFound should create appropriate not found errors', () => {
      const issueError = HulyError.notFound('issue', 'TEST-123');
      expect(issueError.code).toBe(ERROR_CODES.ISSUE_NOT_FOUND);
      expect(issueError.message).toBe('issue TEST-123 not found');

      const projectError = HulyError.notFound('project', 'PROJ');
      expect(projectError.code).toBe(ERROR_CODES.PROJECT_NOT_FOUND);

      const componentError = HulyError.notFound('component', 'Backend');
      expect(componentError.code).toBe(ERROR_CODES.COMPONENT_NOT_FOUND);

      const unknownError = HulyError.notFound('unknown', 'test');
      expect(unknownError.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });

    test('database should create database error', () => {
      const originalError = new Error('Connection timeout');
      const error = HulyError.database('insert', originalError);

      expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR);
      expect(error.message).toBe('Database operation failed: insert');
      expect(error.details.context).toBe('Connection timeout');
      expect(error.details.data.operation).toBe('insert');
    });

    test('connection should create connection error', () => {
      const originalError = new Error('ECONNREFUSED');
      const error = HulyError.connection('MongoDB', originalError);

      expect(error.code).toBe(ERROR_CODES.CONNECTION_ERROR);
      expect(error.message).toBe('Failed to connect to MongoDB');
      expect(error.details.context).toBe('ECONNREFUSED');
    });

    test('permission should create permission error', () => {
      const error = HulyError.permission('delete', 'issue TEST-123');

      expect(error.code).toBe(ERROR_CODES.PERMISSION_ERROR);
      expect(error.message).toBe('Permission denied for delete');
      expect(error.details.context).toContain('delete issue TEST-123');
    });

    test('invalidField should create field error', () => {
      const error = HulyError.invalidField('invalid_field', ['title', 'description', 'status']);

      expect(error.code).toBe(ERROR_CODES.INVALID_FIELD);
      expect(error.message).toBe('Invalid field name: invalid_field');
      expect(error.details.suggestion).toBe('Use one of: title, description, status');
    });

    test('invalidValue should create value error', () => {
      const error = HulyError.invalidValue('priority', 'invalid', 'one of: low, medium, high, urgent');

      expect(error.code).toBe(ERROR_CODES.INVALID_VALUE);
      expect(error.message).toBe("Invalid value for field 'priority'");
      expect(error.details.context).toContain("Value 'invalid'");
      expect(error.details.suggestion).toBe('Expected one of: low, medium, high, urgent');
    });
  });

  describe('Error Inheritance', () => {
    test('should work with try-catch blocks', () => {
      expect(() => {
        throw new HulyError('THROW_TEST', 'Testing throw');
      }).toThrow(HulyError);

      try {
        throw new HulyError('CATCH_TEST', 'Testing catch');
      } catch (error) {
        expect(error).toBeInstanceOf(HulyError);
        expect(error.code).toBe('CATCH_TEST');
      }
    });

    test('should be distinguishable from regular errors', () => {
      const hulyError = new HulyError('HULY', 'Huly error');
      const regularError = new Error('Regular error');

      expect(hulyError).toBeInstanceOf(Error);
      expect(hulyError).toBeInstanceOf(HulyError);
      expect(regularError).toBeInstanceOf(Error);
      expect(regularError).not.toBeInstanceOf(HulyError);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty messages', () => {
      const error = new HulyError('EMPTY_MSG', '');
      const response = error.toMCPResponse();

      expect(response.content[0].text).toBe('❌ Error [EMPTY_MSG]: ');
    });

    test('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      const error = new HulyError('LONG_MSG', longMessage);
      const response = error.toMCPResponse();

      expect(response.content[0].text).toContain(longMessage);
      expect(response.content[0].text.length).toBeGreaterThan(1000);
    });

    test('should handle special characters in messages', () => {
      const error = new HulyError('SPECIAL_CHARS', 'Error with "quotes" and \nnewlines', {
        context: 'Context with <tags> & symbols',
        suggestion: 'Use `backticks` or \'quotes\''
      });

      const response = error.toMCPResponse();
      expect(response.content[0].text).toContain('"quotes"');
      expect(response.content[0].text).toContain('newlines');
      expect(response.content[0].text).toContain('<tags> & symbols');
    });

    test('should handle circular references in details', () => {
      const circular = { prop: 'value' };
      circular.self = circular;

      const error = new HulyError('CIRCULAR', 'Circular test', {
        data: circular
      });

      // Should not throw when accessing details
      expect(error.details.data).toBeDefined();
      expect(() => error.toJSON()).not.toThrow();
    });
  });
});