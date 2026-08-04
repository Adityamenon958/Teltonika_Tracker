'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildReadRequest } = require('../../../../src/protocols/modbus/requestBuilder');
const { parseReadResponse } = require('../../../../src/protocols/modbus/responseParser');
const { applyRegisterProfile } = require('../../../../src/protocols/modbus/applyProfile');
const { verifyModbusCrc, appendModbusCrc } = require('../../../../src/protocols/modbus/crc');
const { getRegisterDefinition } = require('../../../../src/protocols/modbus/devices');

describe('modbus transport', () => {
  it('builds FC04 request with valid CRC', () => {
    const frame = buildReadRequest({
      slaveId: 2,
      functionCode: 4,
      registerAddress: 1,
      registerCount: 1,
    });
    assert.equal(frame.length, 8);
    assert.equal(frame.readUInt8(0), 2);
    assert.equal(frame.readUInt8(1), 4);
    assert.equal(frame.readUInt16BE(2), 1);
    assert.equal(frame.readUInt16BE(4), 1);
    assert.equal(verifyModbusCrc(frame), true);
  });

  it('parses read response into raw words', () => {
    // slave 2, FC04, 2 bytes data, value 5000 (0x1388), + CRC
    const body = Buffer.from([0x02, 0x04, 0x02, 0x13, 0x88]);
    const frame = appendModbusCrc(body);
    const parsed = parseReadResponse(frame, {
      expectedSlaveId: 2,
      expectedFunctionCode: 4,
      expectedRegisterCount: 1,
    });
    assert.deepEqual(parsed.rawWords, [5000]);
  });

  it('applies pm2140 frequency profile divideBy 100', () => {
    const def = getRegisterDefinition('pm2140', 'frequency');
    const scaled = applyRegisterProfile([5000], def);
    assert.equal(scaled.value, 50);
    assert.equal(scaled.unit, 'Hz');
  });

  it('rejects Modbus exception without treating as success', () => {
    // slave 2, FC 0x84 exception illegal data address (0x02)
    const body = Buffer.from([0x02, 0x84, 0x02]);
    const frame = appendModbusCrc(body);
    assert.throws(() =>
      parseReadResponse(frame, {
        expectedSlaveId: 2,
        expectedFunctionCode: 4,
        expectedRegisterCount: 1,
      })
    );
  });
});
