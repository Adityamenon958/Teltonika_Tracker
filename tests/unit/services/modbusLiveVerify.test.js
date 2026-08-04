'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  scheduleLiveModbusReadAfterAuth,
  liveFailureReason,
} = require('../../../src/services/modbusLiveVerify');
const { ModbusError, MODBUS_ERROR } = require('../../../src/protocols/modbus/errors');

describe('modbusLiveVerify', () => {
  it('maps failure reasons clearly', () => {
    assert.equal(
      liveFailureReason(new ModbusError('x', MODBUS_ERROR.TIMEOUT, undefined, true)),
      'timeout'
    );
    assert.equal(
      liveFailureReason(new ModbusError('Tracker offline', MODBUS_ERROR.OFFLINE)),
      'tracker offline'
    );
    assert.equal(
      liveFailureReason(new ModbusError('crc', MODBUS_ERROR.CRC, undefined, true)),
      'CRC failure'
    );
    assert.equal(
      liveFailureReason(new ModbusError('ex', MODBUS_ERROR.EXCEPTION)),
      'Modbus exception'
    );
  });

  it('does not schedule when env IMEI is unset', () => {
    const prev = process.env.MODBUS_LIVE_READ_IMEI;
    delete process.env.MODBUS_LIVE_READ_IMEI;

    const timer = scheduleLiveModbusReadAfterAuth({
      imei: '352094081234567',
      connectionId: 'c1',
      modbusSession: { readConfiguredRegister: async () => ({}) },
      logger: { info() {}, warn() {}, error() {} },
      delayMs: 10,
    });

    assert.equal(timer, null);
    if (prev !== undefined) process.env.MODBUS_LIVE_READ_IMEI = prev;
  });

  it('schedules only when env IMEI matches and runs once after delay', async () => {
    const prev = process.env.MODBUS_LIVE_READ_IMEI;
    const prevDelay = process.env.MODBUS_LIVE_READ_DELAY_MS;
    process.env.MODBUS_LIVE_READ_IMEI = '352094081234567';
    process.env.MODBUS_LIVE_READ_DELAY_MS = '20';

    let called = 0;
    const logs = [];
    const logger = {
      info: (obj, msg) => logs.push(msg || obj),
      warn: () => {},
      error: () => {},
    };

    const timer = scheduleLiveModbusReadAfterAuth({
      imei: '352094081234567',
      connectionId: 'c1',
      modbusSession: {
        readConfiguredRegister: async () => {
          called += 1;
          return {
            value: 50,
            unit: 'Hz',
            name: 'Frequency (F)',
            rawWords: [5000],
            durationMs: 12,
          };
        },
      },
      logger,
      delayMs: 20,
    });

    assert.ok(timer);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(called, 1);
    assert.ok(logs.includes('Scheduling live Modbus read'));
    assert.ok(logs.includes('Sending Codec12 Modbus request'));
    assert.ok(logs.includes('Decoded Frequency'));
    assert.ok(logs.includes('Live Modbus read completed'));

    if (prev !== undefined) process.env.MODBUS_LIVE_READ_IMEI = prev;
    else delete process.env.MODBUS_LIVE_READ_IMEI;
    if (prevDelay !== undefined) process.env.MODBUS_LIVE_READ_DELAY_MS = prevDelay;
    else delete process.env.MODBUS_LIVE_READ_DELAY_MS;
  });

  it('does not schedule for a different IMEI', () => {
    const prev = process.env.MODBUS_LIVE_READ_IMEI;
    process.env.MODBUS_LIVE_READ_IMEI = '111111111111111';

    const timer = scheduleLiveModbusReadAfterAuth({
      imei: '352094081234567',
      connectionId: 'c1',
      modbusSession: { readConfiguredRegister: async () => ({}) },
      logger: { info() {}, warn() {}, error() {} },
      delayMs: 10,
    });

    assert.equal(timer, null);
    if (prev !== undefined) process.env.MODBUS_LIVE_READ_IMEI = prev;
    else delete process.env.MODBUS_LIVE_READ_IMEI;
  });
});
