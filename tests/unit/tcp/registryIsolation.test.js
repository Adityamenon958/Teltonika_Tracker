'use strict';

/**
 * ✅ Regression: multi-tracker registry isolation (no global Modbus lock).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { ConnectionRegistry } = require('../../../src/tcp/ConnectionRegistry');

function mockSocket(id) {
  const sock = new EventEmitter();
  sock.id = id;
  sock.destroyed = false;
  sock.write = () => true;
  sock.destroy = () => {
    sock.destroyed = true;
  };
  return sock;
}

describe('multi-tracker registry regression', () => {
  it('tracks multiple IMEIs independently', () => {
    const registry = new ConnectionRegistry();
    const a = mockSocket('a');
    const b = mockSocket('b');

    registry.add('111111111111111', { connectionId: 'c1', socket: a, remoteAddress: '1.1.1.1' });
    registry.add('222222222222222', { connectionId: 'c2', socket: b, remoteAddress: '2.2.2.2' });

    assert.equal(registry.size(), 2);
    assert.equal(registry.get('111111111111111').socket.id, 'a');
    assert.equal(registry.get('222222222222222').socket.id, 'b');

    registry.remove('111111111111111', 'c1');
    assert.equal(registry.size(), 1);
    assert.ok(registry.get('222222222222222'));
  });
});
