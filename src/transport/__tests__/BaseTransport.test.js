/**
 * Tests for BaseTransport
 */

import { jest } from '@jest/globals';
import { BaseTransport } from '../BaseTransport.js';

describe('BaseTransport', () => {
  it('should not be instantiable directly', () => {
    expect(() => new BaseTransport({})).toThrow(
      'BaseTransport is an abstract class and cannot be instantiated directly'
    );
  });

  it('should be extendable', () => {
    class TestTransport extends BaseTransport {
      async start() {
        return;
      }
      async stop() {
        return;
      }
      getType() {
        return 'test';
      }
      isRunning() {
        return false;
      }
    }

    const server = { connect: jest.fn() };
    const transport = new TestTransport(server);
    expect(transport).toBeInstanceOf(BaseTransport);
    expect(transport.server).toBe(server);
  });

  it('should require subclasses to implement abstract methods', async () => {
    class IncompleteTransport extends BaseTransport {}

    const server = { connect: jest.fn() };
    const transport = new IncompleteTransport(server);

    await expect(() => transport.start()).rejects.toThrow(
      'start() method must be implemented by subclass'
    );
    await expect(() => transport.stop()).rejects.toThrow(
      'stop() method must be implemented by subclass'
    );
    expect(() => transport.getType()).toThrow('getType() method must be implemented by subclass');
    expect(() => transport.isRunning()).toThrow(
      'isRunning() method must be implemented by subclass'
    );
  });
});
