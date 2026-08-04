'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyFrame } = require('../../../src/tcp/FrameClassifier');
const { buildCodec12Packet } = require('../../../src/protocols/teltonika/codecs/codec12');
const teltonika = require('../../../src/constants/teltonika');
const { buildRecordCountAck, buildLoginResponse } = require('../../../src/protocols/teltonika/ackBuilder');

describe('frameClassifier', () => {
  it('classifies Codec 12 packets', () => {
    const packet = buildCodec12Packet(Buffer.from([0x01, 0x03]), teltonika.TYPE_SERIAL_FORWARD);
    assert.equal(classifyFrame(packet), 'CODEC12');
  });

  it('classifies AVL codec 8 after preamble', () => {
    // minimal fake: preamble + length + codec 08 ...
    const buf = Buffer.alloc(12);
    buf.writeUInt32BE(0, 0);
    buf.writeUInt32BE(10, 4);
    buf.writeUInt8(0x08, 8);
    assert.equal(classifyFrame(buf), 'AVL');
  });

  it('returns NEED_MORE for short zero preamble', () => {
    assert.equal(classifyFrame(Buffer.from([0x00, 0x00])), 'NEED_MORE');
  });
});

describe('AVL ACK regression', () => {
  it('builds 4-byte BE record count ACK', () => {
    const ack = buildRecordCountAck(2);
    assert.equal(ack.length, 4);
    assert.equal(ack.readUInt32BE(0), 2);
  });

  it('builds login accept 0x01', () => {
    assert.deepEqual([...buildLoginResponse(true)], [0x01]);
    assert.deepEqual([...buildLoginResponse(false)], [0x00]);
  });
});
