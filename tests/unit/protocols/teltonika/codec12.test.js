'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCodec12Packet,
  tryConsumeCodec12Frame,
} = require('../../../../src/protocols/teltonika/codecs/codec12');
const teltonika = require('../../../../src/constants/teltonika');

describe('codec12', () => {
  it('builds and parses a round-trip packet', () => {
    const payload = Buffer.from('getinfo', 'ascii');
    const packet = buildCodec12Packet(payload, teltonika.TYPE_COMMAND);
    const frame = tryConsumeCodec12Frame(packet);
    assert.ok(frame);
    assert.equal(frame.type, teltonika.TYPE_COMMAND);
    assert.equal(frame.payload.toString('ascii'), 'getinfo');
    assert.equal(frame.bytesConsumed, packet.length);
  });

  it('parses official getinfo command vector', () => {
    const hex = '000000000000000F0C010500000007676574696E666F0100004312';
    const packet = Buffer.from(hex, 'hex');
    const frame = tryConsumeCodec12Frame(packet);
    assert.ok(frame);
    assert.equal(frame.type, 0x05);
    assert.equal(frame.payload.toString('ascii'), 'getinfo');
  });

  it('parses official Modbus serial-forward vector (Type 0x0E)', () => {
    const hex = '00000000000000100C010E00000008010300000008440C0100001181';
    const packet = Buffer.from(hex, 'hex');
    const frame = tryConsumeCodec12Frame(packet);
    assert.ok(frame);
    assert.equal(frame.type, teltonika.TYPE_SERIAL_FORWARD);
    assert.equal(frame.payload.toString('hex'), '010300000008440c');
  });

  it('returns null for incomplete packet', () => {
    const payload = Buffer.from([0x01, 0x03]);
    const packet = buildCodec12Packet(payload, teltonika.TYPE_SERIAL_FORWARD);
    assert.equal(tryConsumeCodec12Frame(packet.subarray(0, 10)), null);
  });

  it('throws on CRC mismatch', () => {
    const hex = '000000000000000F0C010500000007676574696E666F0100004312';
    const packet = Buffer.from(hex, 'hex');
    packet[packet.length - 1] ^= 0xff;
    assert.throws(() => tryConsumeCodec12Frame(packet));
  });
});
