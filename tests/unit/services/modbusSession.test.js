'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { ConnectionRegistry } = require('../../../src/tcp/ConnectionRegistry');
const { ModbusSessionService } = require('../../../src/services/modbusSessionService');
const { appendModbusCrc } = require('../../../src/protocols/modbus/crc');
const teltonika = require('../../../src/constants/teltonika');

function mockSocket() {
  const sock = new EventEmitter();
  sock.destroyed = false;
  sock.writes = [];
  sock.write = (buf) => {
    sock.writes.push(Buffer.from(buf));
    return true;
  };
  sock.destroy = () => {
    sock.destroyed = true;
  };
  return sock;
}

describe('modbusSessionService', () => {
  it('readRegister sends Codec12 and resolves scaled frequency from profile', async () => {
    const registry = new ConnectionRegistry();
    const socket = mockSocket();
    const imei = '352094081234567';
    registry.add(imei, { connectionId: 'c1', socket, remoteAddress: '1.2.3.4' });

    const config = {
      modbus: {
        responseTimeoutMs: 2000,
        maxRetries: 1,
        queueMaxPerImei: 10,
        debug: false,
      },
    };

    const svc = new ModbusSessionService({ registry, config });

    const promise = svc.readConfiguredRegister(imei, 'pm2140', 'frequency');

    // Allow enqueue to write
    await new Promise((r) => setImmediate(r));
    assert.ok(socket.writes.length >= 1);

    // Build fake Modbus response: slave2 FC04 2 data bytes value 5000
    const body = Buffer.from([0x02, 0x04, 0x02, 0x13, 0x88]);
    const modbusReply = appendModbusCrc(body);
    svc.handleInbound(imei, modbusReply);

    const result = await promise;
    assert.equal(result.value, 50);
    assert.equal(result.unit, 'Hz');
    assert.deepEqual(result.rawWords, [5000]);

    // Outbound should be Codec 12 Type 0x0E
    const outbound = socket.writes[0];
    assert.equal(outbound.readUInt8(8), teltonika.CODEC_12);
    assert.equal(outbound.readUInt8(10), teltonika.TYPE_SERIAL_FORWARD);
  });

  it('fails offline tracker without hanging', async () => {
    const registry = new ConnectionRegistry();
    const svc = new ModbusSessionService({
      registry,
      config: { modbus: { responseTimeoutMs: 500, maxRetries: 0, debug: false } },
    });

    await assert.rejects(
      () => svc.readRegister('999999999999999', 2, 4, 1, 1),
      /offline/i
    );
  });
});
