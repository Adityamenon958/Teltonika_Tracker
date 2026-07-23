'use strict';

/**
 * ✅ Build a minimal Codec 8 AVL data field + full TCP packet for tests.
 */

const { calculateAvlCrc } = require('../../../src/protocols/teltonika/frameParser');

/**
 * One AVL record with zero IO elements.
 * GPS: lon/lat as degrees → raw * 1e7
 */
function buildCodec8Record({
  timestampMs = 1700000000000n,
  priority = 0,
  longitude = 25.27,
  latitude = 54.68,
  altitude = 100,
  angle = 90,
  satellites = 8,
  speed = 50,
  eventIoId = 0,
} = {}) {
  const parts = [];

  const ts = Buffer.alloc(8);
  ts.writeBigUInt64BE(BigInt(timestampMs), 0);
  parts.push(ts);

  parts.push(Buffer.from([priority & 0xff]));

  const lon = Buffer.alloc(4);
  lon.writeInt32BE(Math.round(longitude * 10000000), 0);
  parts.push(lon);

  const lat = Buffer.alloc(4);
  lat.writeInt32BE(Math.round(latitude * 10000000), 0);
  parts.push(lat);

  const alt = Buffer.alloc(2);
  alt.writeInt16BE(altitude, 0);
  parts.push(alt);

  const ang = Buffer.alloc(2);
  ang.writeUInt16BE(angle, 0);
  parts.push(ang);

  parts.push(Buffer.from([satellites & 0xff]));

  const spd = Buffer.alloc(2);
  spd.writeUInt16BE(speed, 0);
  parts.push(spd);

  parts.push(Buffer.from([eventIoId & 0xff])); // event IO
  parts.push(Buffer.from([0])); // total IO count
  parts.push(Buffer.from([0])); // n1
  parts.push(Buffer.from([0])); // n2
  parts.push(Buffer.from([0])); // n4
  parts.push(Buffer.from([0])); // n8

  return Buffer.concat(parts);
}

/**
 * @param {Buffer[]} records
 * @returns {Buffer} data field only
 */
function buildCodec8DataField(records) {
  const count = records.length;
  return Buffer.concat([
    Buffer.from([0x08, count]),
    ...records,
    Buffer.from([count]),
  ]);
}

/**
 * Full Teltonika AVL TCP packet: preamble + length + data + crc
 * @param {Buffer} dataField
 */
function buildAvlPacket(dataField) {
  const preamble = Buffer.alloc(4); // 0x00000000
  const length = Buffer.alloc(4);
  length.writeUInt32BE(dataField.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(calculateAvlCrc(dataField), 0);
  return Buffer.concat([preamble, length, dataField, crc]);
}

module.exports = {
  buildCodec8Record,
  buildCodec8DataField,
  buildAvlPacket,
};
