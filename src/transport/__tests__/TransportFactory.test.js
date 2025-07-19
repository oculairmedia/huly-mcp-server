/**
 * Tests for TransportFactory
 */

import { jest } from '@jest/globals';
import { TransportFactory } from '../TransportFactory.js';
import { StdioTransport } from '../StdioTransport.js';
import { HttpTransport } from '../HttpTransport.js';

describe('TransportFactory', () => {
  const mockServer = { connect: jest.fn() };

  describe('create()', () => {
    it('should create StdioTransport for "stdio" type', () => {
      const transport = TransportFactory.create('stdio', mockServer);
      expect(transport).toBeInstanceOf(StdioTransport);
    });

    it('should create HttpTransport for "http" type', () => {
      const transport = TransportFactory.create('http', mockServer);
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it('should be case-insensitive', () => {
      const transport1 = TransportFactory.create('STDIO', mockServer);
      expect(transport1).toBeInstanceOf(StdioTransport);

      const transport2 = TransportFactory.create('HTTP', mockServer);
      expect(transport2).toBeInstanceOf(HttpTransport);
    });

    it('should pass options to HttpTransport', () => {
      const options = { port: 4000, toolDefinitions: [] };
      const transport = TransportFactory.create('http', mockServer, options);
      expect(transport.port).toBe(4000);
      expect(transport.toolDefinitions).toEqual([]);
    });

    it('should throw error for unknown transport type', () => {
      expect(() => TransportFactory.create('unknown', mockServer)).toThrow(
        'Unknown transport type: unknown. Supported types: stdio, http'
      );
    });
  });

  describe('getSupportedTypes()', () => {
    it('should return array of supported types', () => {
      const types = TransportFactory.getSupportedTypes();
      expect(types).toEqual(['stdio', 'http']);
    });
  });

  describe('isSupported()', () => {
    it('should return true for supported types', () => {
      expect(TransportFactory.isSupported('stdio')).toBe(true);
      expect(TransportFactory.isSupported('http')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(TransportFactory.isSupported('websocket')).toBe(false);
      expect(TransportFactory.isSupported('unknown')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(TransportFactory.isSupported('STDIO')).toBe(true);
      expect(TransportFactory.isSupported('HTTP')).toBe(true);
    });
  });
});
