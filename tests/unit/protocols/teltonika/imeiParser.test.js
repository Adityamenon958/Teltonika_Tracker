'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tryParseImeiLogin, isValidImeiFormat } = require('../../../../src/protocols/teltonika/imeiParser');
const { ProtocolError } = require('../../../../src/errors/ProtocolError');

describe('imeiParser', () => {
  it('parses a valid 15-digit IMEI login packet', () => {
    const imei = '352094081234567';
    const packet = Buffer.alloc(2 + imei.length);
    packet.writeUInt16BE(imei.length, 0);
    packet.write(imei, 2, 'ascii');

    const result = tryParseImeiLogin(packet);
    assert.ok(result);
    assert.equal(result.imei, imei);
    assert.equal(result.bytesConsumed, 2 + imei.length);
  });

  it('returns null when packet is incomplete', () => {
    const partial = Buffer.from([0x00, 0x0f, 0x33, 0x35]);
    assert.equal(tryParseImeiLogin(partial), null);
  });

  it('returns null when length header alone is present', () => {
    assert.equal(tryParseImeiLogin(Buffer.from([0x00, 0x0f])), null);
  });

  it('throws on invalid IMEI characters', () => {
    const imei = '35209408123456A';
    const packet = Buffer.alloc(2 + imei.length);
    packet.writeUInt16BE(imei.length, 0);
    packet.write(imei, 2, 'ascii');

    assert.throws(() => tryParseImeiLogin(packet), ProtocolError);
  });

  it('throws when AVL preamble arrives instead of IMEI', () => {
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(0x00000000, 0);
    buf.writeUInt32BE(10, 4);
    assert.throws(() => tryParseImeiLogin(buf), ProtocolError);
  });

  it('isValidImeiFormat accepts 15–16 digits only', () => {
    assert.equal(isValidImeiFormat('352094081234567'), true);
    assert.equal(isValidImeiFormat('3520940812345678'), true);
    assert.equal(isValidImeiFormat('123'), false);
    assert.equal(isValidImeiFormat('abcdefghijklmno'), false);
  });
});
