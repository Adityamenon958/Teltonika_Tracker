'use strict';

/**
 * ✅ ConnectionHandler drain race + Codec12 demux (AVL ACK path stays independent).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { ConnectionHandler } = require('../../../src/tcp/ConnectionHandler');
const { ConnectionRegistry } = require('../../../src/tcp/ConnectionRegistry');
const { ModbusSessionService } = require('../../../src/services/modbusSessionService');
const { buildCodec12Packet } = require('../../../src/protocols/teltonika/codecs/codec12');
const { appendModbusCrc } = require('../../../src/protocols/modbus/crc');
const teltonika = require('../../../src/constants/teltonika');

function mockSocket() {
  const sock = new EventEmitter();
  sock.remoteAddress = '127.0.0.1';
  sock.remotePort = 12345;
  sock.destroyed = false;
  sock.writes = [];
  sock.setKeepAlive = () => {};
  sock.setTimeout = () => {};
  sock.write = (buf) => {
    sock.writes.push(Buffer.from(buf));
    return true;
  };
  sock.destroy = () => {
    sock.destroyed = true;
    sock.emit('close');
  };
  return sock;
}

describe('ConnectionHandler drain + Codec12 demux', () => {
  it('delivers Type 0x06 payload to modbusSession without needing AVL', async () => {
    const registry = new ConnectionRegistry();
    const config = {
      maxBufferBytes: 1024 * 1024,
      socketIdleTimeoutMs: 60_000,
      imeiAuthMode: 'open',
      modbus: { responseTimeoutMs: 2000, maxRetries: 0, queue: false },
    };
    const modbusSession = new ModbusSessionService({ registry, config });
    const socket = mockSocket();

    const handler = new ConnectionHandler(socket, { config, registry, modbusSession });

    // Force AUTHED state (skip real IMEI/Mongo)
    handler.state = 'AUTHED';
    handler.imei = '352094081234567';
    registry.add(handler.imei, {
      connectionId: handler.connectionId,
      socket,
      remoteAddress: '127.0.0.1',
    });

    const promise = modbusSession.readConfiguredRegister(handler.imei, 'pm2140', 'frequency');
    await new Promise((r) => setImmediate(r));

    const body = Buffer.from([0x02, 0x04, 0x02, 0x13, 0x88]);
    const modbusReply = appendModbusCrc(body);
    const c12 = buildCodec12Packet(modbusReply, teltonika.TYPE_RESPONSE);

    // Simulate inbound Codec 12 on the TCP socket
    socket.emit('data', c12);

    // Allow drain loop
    await new Promise((r) => setTimeout(r, 50));

    const result = await promise;
    assert.equal(result.value, 50);
    assert.equal(result.unit, 'Hz');
  });

  it('drains bytes that arrive during async processing (_needsDrain)', async () => {
    const registry = new ConnectionRegistry();
    const config = {
      maxBufferBytes: 1024 * 1024,
      socketIdleTimeoutMs: 60_000,
      modbus: { responseTimeoutMs: 2000, maxRetries: 0, debug: false },
    };
    const modbusSession = new ModbusSessionService({ registry, config });
    const socket = mockSocket();
    const handler = new ConnectionHandler(socket, { config, registry, modbusSession });

    handler.state = 'AUTHED';
    handler.imei = '352094081234568';
    registry.add(handler.imei, {
      connectionId: handler.connectionId,
      socket,
      remoteAddress: '127.0.0.1',
    });

    // Fake slow processing by setting _processing and injecting data
    handler._processing = true;
    const body = Buffer.from([0x02, 0x04, 0x02, 0x13, 0x88]);
    const modbusReply = appendModbusCrc(body);
    const c12 = buildCodec12Packet(modbusReply, teltonika.TYPE_RESPONSE);

    // This path sets _needsDrain because _processing is true
    await handler._onData(c12);
    assert.equal(handler._needsDrain, true);
    assert.ok(handler.buffer.length > 0);

    // Release processing and drain
    handler._processing = false;
    handler._needsDrain = false;
    await handler._onData(Buffer.alloc(0));

    // Frame should be consumed after drain
    assert.equal(handler.buffer.length, 0);
  });
});
