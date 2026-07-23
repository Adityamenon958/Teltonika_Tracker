'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { decodeCodec8 } = require('../../../../src/protocols/teltonika/codecs/codec8');
const { decodeAvlDataField } = require('../../../../src/protocols/teltonika/codecs/registry');
const { tryConsumeAvlFrame } = require('../../../../src/protocols/teltonika/frameParser');
const { ProtocolError } = require('../../../../src/errors/ProtocolError');
const {
  buildCodec8Record,
  buildCodec8DataField,
  buildAvlPacket,
} = require('../../../fixtures/codec8/buildPacket');
const fs = require('fs');
const path = require('path');

describe('codec8 decoder', () => {
  it('decodes a single AVL record with GPS fields', () => {
    const record = buildCodec8Record({
      timestampMs: 1700000000000n,
      longitude: 25.27,
      latitude: 54.68,
      altitude: 100,
      angle: 90,
      satellites: 8,
      speed: 50,
    });
    const dataField = buildCodec8DataField([record]);
    const decoded = decodeCodec8(dataField);

    assert.equal(decoded.codecId, 0x08);
    assert.equal(decoded.numberOfRecords, 1);
    assert.equal(decoded.records.length, 1);

    const r = decoded.records[0];
    assert.equal(r.timestampMs, '1700000000000');
    assert.equal(r.priority, 0);
    assert.ok(Math.abs(r.gps.longitude - 25.27) < 0.0000001);
    assert.ok(Math.abs(r.gps.latitude - 54.68) < 0.0000001);
    assert.equal(r.gps.altitude, 100);
    assert.equal(r.gps.angle, 90);
    assert.equal(r.gps.satellites, 8);
    assert.equal(r.gps.speed, 50);
    assert.equal(r.io.totalIoCount, 0);
  });

  it('decodes multiple records', () => {
    const dataField = buildCodec8DataField([
      buildCodec8Record({ speed: 10 }),
      buildCodec8Record({ speed: 20 }),
    ]);
    const decoded = decodeCodec8(dataField);
    assert.equal(decoded.numberOfRecords, 2);
    assert.equal(decoded.records[0].gps.speed, 10);
    assert.equal(decoded.records[1].gps.speed, 20);
  });

  it('throws on unsupported codec id', () => {
    const bad = Buffer.from([0x8e, 0x00, 0x00]);
    assert.throws(() => decodeCodec8(bad), ProtocolError);
  });

  it('registry routes codec 8', () => {
    const dataField = buildCodec8DataField([buildCodec8Record()]);
    const decoded = decodeAvlDataField(dataField);
    assert.equal(decoded.codecId, 0x08);
  });
});

describe('AVL frame + codec8 integration', () => {
  it('consumes a full packet and decodes payload', () => {
    const dataField = buildCodec8DataField([
      buildCodec8Record({
        timestampMs: 1609459200000n, // 2021-01-01
        longitude: 23.9,
        latitude: 54.9,
      }),
    ]);
    const packet = buildAvlPacket(dataField);

    // Persist hex fixture for debugging / future tests
    const hexPath = path.join(__dirname, '../../../fixtures/codec8/sample-single-record.hex');
    fs.writeFileSync(hexPath, packet.toString('hex'), 'utf8');

    const frame = tryConsumeAvlFrame(packet);
    assert.ok(frame);
    assert.equal(frame.bytesConsumed, packet.length);

    const decoded = decodeCodec8(frame.dataField);
    assert.equal(decoded.numberOfRecords, 1);
    assert.ok(Math.abs(decoded.records[0].gps.longitude - 23.9) < 0.0000001);
  });

  it('returns null when frame is fragmented', () => {
    const dataField = buildCodec8DataField([buildCodec8Record()]);
    const packet = buildAvlPacket(dataField);
    const partial = packet.subarray(0, 10);
    assert.equal(tryConsumeAvlFrame(partial), null);
  });

  it('throws on CRC mismatch', () => {
    const dataField = buildCodec8DataField([buildCodec8Record()]);
    const packet = buildAvlPacket(dataField);
    packet[packet.length - 1] ^= 0xff;
    assert.throws(() => tryConsumeAvlFrame(packet), ProtocolError);
  });
});
