/**
 * Tests for Logger module
 */

import { jest } from '@jest/globals';
import { Logger, getLogger, createLoggerWithConfig, resetLogger } from '../Logger.js';

describe('Logger', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let consoleOutput;
  let consoleErrorOutput;

  beforeEach(() => {
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    consoleOutput = [];
    consoleErrorOutput = [];

    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });

    console.error = jest.fn((...args) => {
      consoleErrorOutput.push(args.join(' '));
    });

    // Reset the logger singleton
    resetLogger();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('log levels', () => {
    it('should log messages at or above the configured level', () => {
      const logger = new Logger('test', { level: 'info' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleOutput).toHaveLength(2); // info and warn
      expect(consoleErrorOutput).toHaveLength(1); // error

      expect(consoleOutput[0]).toContain('info message');
      expect(consoleOutput[1]).toContain('warn message');
      expect(consoleErrorOutput[0]).toContain('error message');
    });

    it('should log all messages when level is debug', () => {
      const logger = new Logger('test', { level: 'debug' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleOutput).toHaveLength(3); // debug, info, warn
      expect(consoleErrorOutput).toHaveLength(1); // error
    });

    it('should only log errors when level is error', () => {
      const logger = new Logger('test', { level: 'error' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleOutput).toHaveLength(0);
      expect(consoleErrorOutput).toHaveLength(1);
      expect(consoleErrorOutput[0]).toContain('error message');
    });
  });

  describe('output formats', () => {
    it('should output text format by default', () => {
      const logger = new Logger('test', { level: 'info' });

      logger.info('test message', { key: 'value' });

      expect(consoleOutput).toHaveLength(1);
      const output = consoleOutput[0];

      expect(output).toContain('INFO');
      expect(output).toContain('test message');
      expect(output).toContain('"key": "value"');
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    it('should output JSON format when configured', () => {
      const logger = new Logger('test', { level: 'info', format: 'json' });

      logger.info('test message', { key: 'value' });

      expect(consoleOutput).toHaveLength(1);
      const output = JSON.parse(consoleOutput[0]);

      expect(output).toHaveProperty('timestamp');
      expect(output).toHaveProperty('level', 'info');
      expect(output).toHaveProperty('logger', 'test');
      expect(output).toHaveProperty('message', 'test message');
      expect(output).toHaveProperty('key', 'value');
    });
  });

  describe('error handling', () => {
    it('should handle Error objects specially', () => {
      const logger = new Logger('test', { level: 'error' });
      const error = new Error('test error');

      logger.error('An error occurred', error);

      expect(consoleErrorOutput).toHaveLength(1);
      const output = consoleErrorOutput[0];

      expect(output).toContain('An error occurred');
      expect(output).toContain('"message": "test error"');
      expect(output).toContain('"name": "Error"');
      expect(output).toContain('"stack"');
    });

    it('should handle custom error properties', () => {
      const logger = new Logger('test', { level: 'error' });
      const error = new Error('test error');
      error.code = 'TEST_ERROR';
      error.statusCode = 500;

      logger.error('Custom error', error);

      expect(consoleErrorOutput).toHaveLength(1);
      const output = consoleErrorOutput[0];

      expect(output).toContain('"code": "TEST_ERROR"');
      expect(output).toContain('"statusCode": 500');
    });
  });

  describe('child loggers', () => {
    it('should create child logger with parent context', () => {
      const parent = new Logger('parent', { level: 'info' });
      const child = parent.child('child', { parentId: '123' });

      child.info('child message', { childData: 'test' });

      expect(consoleOutput).toHaveLength(1);
      const output = consoleOutput[0];

      expect(output).toContain('[parent:child]');
      expect(output).toContain('child message');
      expect(output).toContain('"childData": "test"');
    });

    it('should inherit parent log level', () => {
      const parent = new Logger('parent', { level: 'warn' });
      const child = parent.child('child');

      child.debug('debug message');
      child.info('info message');
      child.warn('warn message');

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain('warn message');
    });

    it('should not display default context in output', () => {
      const parent = new Logger('parent', { level: 'info' });
      const child = parent.child('child', { serviceId: 'svc123' });

      child.info('message', { serviceId: 'svc123', extra: 'data' });

      expect(consoleOutput).toHaveLength(1);
      const output = consoleOutput[0];

      // Should only show extra data, not repeated serviceId
      expect(output).toContain('"extra": "data"');
      expect(output.match(/serviceId/g)?.length || 0).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const logger1 = getLogger({ level: 'info' });
      const logger2 = getLogger({ level: 'debug' }); // Options ignored on second call

      expect(logger1).toBe(logger2);

      // Should use the first set of options
      logger1.debug('debug message');
      expect(consoleOutput).toHaveLength(0); // Debug not logged with info level
    });

    it('should reset singleton instance', () => {
      const logger1 = getLogger({ level: 'info' });
      resetLogger();
      const logger2 = getLogger({ level: 'debug' });

      expect(logger1).not.toBe(logger2);

      logger2.debug('debug message');
      expect(consoleOutput).toHaveLength(1); // Debug logged with debug level
    });
  });

  describe('createLoggerWithConfig', () => {
    it('should create logger with config manager settings', () => {
      const mockConfigManager = {
        get: (path, defaultValue) => {
          const values = {
            'logging.level': 'warn',
            'logging.format': 'json'
          };
          return values[path] || defaultValue;
        }
      };

      const logger = createLoggerWithConfig(mockConfigManager);

      logger.info('info message');
      logger.warn('warn message');

      expect(consoleOutput).toHaveLength(1);
      const output = JSON.parse(consoleOutput[0]);

      expect(output).toHaveProperty('level', 'warn');
      expect(output).toHaveProperty('logger', 'huly-mcp');
      expect(output).toHaveProperty('message', 'warn message');
    });
  });

  describe('color output', () => {
    beforeEach(() => {
      // Reset NO_COLOR env var
      delete process.env.NO_COLOR;
    });

    it('should include color codes when TTY is available', () => {
      const _logger = new Logger('test', { level: 'info' });
      // Mock TTY
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      // Create new logger to pick up TTY setting
      const colorLogger = new Logger('color-test', { level: 'info' });
      colorLogger.info('info message');

      expect(consoleOutput).toHaveLength(1);
      const output = consoleOutput[0];

      // Check for ANSI color codes
      expect(output).toContain('\x1b[32m'); // Green for info
      expect(output).toContain('\x1b[0m'); // Reset

      // Restore
      process.stdout.isTTY = originalIsTTY;
    });

    it('should not include color codes when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';

      const logger = new Logger('test', { level: 'info' });
      logger.info('info message');

      expect(consoleOutput).toHaveLength(1);
      const output = consoleOutput[0];

      // Should not contain ANSI color codes
      expect(output).not.toContain('\x1b[');
    });
  });

  describe('emojis', () => {
    it('should include emojis for each log level', () => {
      const logger = new Logger('test', { level: 'debug' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleOutput[0]).toContain('🐛'); // debug
      expect(consoleOutput[1]).toContain('📘'); // info
      expect(consoleOutput[2]).toContain('⚠️'); // warn
      expect(consoleErrorOutput[0]).toContain('❌'); // error
    });
  });

  describe('context handling', () => {
    it('should merge context with message', () => {
      const logger = new Logger('test', { level: 'info' });

      logger.info('user action', {
        userId: '123',
        action: 'login',
        metadata: { ip: '127.0.0.1' }
      });

      expect(consoleOutput).toHaveLength(1);
      const output = consoleOutput[0];

      expect(output).toContain('"userId": "123"');
      expect(output).toContain('"action": "login"');
      expect(output).toContain('"ip": "127.0.0.1"');
    });

    it('should handle empty context', () => {
      const logger = new Logger('test', { level: 'info' });

      logger.info('simple message');

      expect(consoleOutput).toHaveLength(1);
      const output = consoleOutput[0];

      expect(output).toContain('simple message');
      expect(output).not.toContain(' - '); // No context separator
    });
  });
});