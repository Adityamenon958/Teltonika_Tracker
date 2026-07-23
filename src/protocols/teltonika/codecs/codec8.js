'use strict';

const { ProtocolError } = require('../../../errors/ProtocolError');
const { ERROR_CODES } = require('../../../constants/errors');
const teltonika = require('../../../constants/teltonika');
const {
  readUInt8,
  readUInt16BE,
  readInt16BE,
  readInt32BE,
  readUInt64BE,
} = require('../../../utils/binary');

/**
 * ✅ Decode Teltonika Codec 8 AVL data field (WITHOUT preamble/CRC).
 * Data field layout:
 *   codecId(1) + numberOfData1(1) + AVL records... + numberOfData2(1)
 *
 * Returns plain protocol objects — NO Mongo / Dashboard field names.
 *
 * @param {Buffer} dataField
 * @returns {{ codecId: number, numberOfRecords: number, records: object[] }}
 */
function decodeCodec8(dataField) {
  if (!Buffer.isBuffer(dataField) || dataField.length < 3) {
    throw new ProtocolError('Codec 8 data field too short', {
      length: dataField?.length,
    });
  }

  let offset = 0;
  const codecId = readUInt8(dataField, offset);
  offset += 1;

  if (codecId !== teltonika.CODEC_8) {
    const err = new ProtocolError(`Unsupported codec ID: 0x${codecId.toString(16)}`, {
      codecId,
    });
    err.code = ERROR_CODES.UNSUPPORTED_CODEC;
    throw err;
  }

  const numberOfData1 = readUInt8(dataField, offset);
  offset += 1;

  const records = [];
  for (let i = 0; i < numberOfData1; i += 1) {
    const parsed = readAvlRecord(dataField, offset);
    records.push(parsed.record);
    offset = parsed.nextOffset;
  }

  if (offset >= dataField.length) {
    throw new ProtocolError('Codec 8 missing numberOfData2 footer');
  }

  const numberOfData2 = readUInt8(dataField, offset);
  offset += 1;

  if (numberOfData1 !== numberOfData2) {
    throw new ProtocolError(
      `Codec 8 record count mismatch (${numberOfData1} vs ${numberOfData2})`,
      { numberOfData1, numberOfData2 }
    );
  }

  if (offset !== dataField.length) {
    throw new ProtocolError(
      `Codec 8 trailing bytes: consumed ${offset}, length ${dataField.length}`,
      { offset, length: dataField.length }
    );
  }

  return {
    codecId,
    numberOfRecords: numberOfData1,
    records,
  };
}

/**
 * @param {Buffer} buf
 * @param {number} offset
 */
function readAvlRecord(buf, offset) {
  const start = offset;

  if (buf.length - offset < 15 + 1 + 1) {
    throw new ProtocolError('Incomplete Codec 8 AVL record header');
  }

  const timestampMs = readUInt64BE(buf, offset);
  offset += 8;

  const priority = readUInt8(buf, offset);
  offset += 1;

  const longitudeRaw = readInt32BE(buf, offset);
  offset += 4;
  const latitudeRaw = readInt32BE(buf, offset);
  offset += 4;

  const altitude = readInt16BE(buf, offset);
  offset += 2;
  const angle = readUInt16BE(buf, offset);
  offset += 2;
  const satellites = readUInt8(buf, offset);
  offset += 1;
  const speed = readUInt16BE(buf, offset);
  offset += 2;

  const eventIoId = readUInt8(buf, offset);
  offset += 1;
  const totalIoCount = readUInt8(buf, offset);
  offset += 1;

  const io = {
    eventIoId,
    totalIoCount,
    oneByte: {},
    twoByte: {},
    fourByte: {},
    eightByte: {},
  };

  // 1-byte IO
  const n1 = readUInt8(buf, offset);
  offset += 1;
  for (let i = 0; i < n1; i += 1) {
    const id = readUInt8(buf, offset);
    offset += 1;
    const value = readUInt8(buf, offset);
    offset += 1;
    io.oneByte[id] = value;
  }

  // 2-byte IO
  const n2 = readUInt8(buf, offset);
  offset += 1;
  for (let i = 0; i < n2; i += 1) {
    const id = readUInt8(buf, offset);
    offset += 1;
    const value = readUInt16BE(buf, offset);
    offset += 2;
    io.twoByte[id] = value;
  }

  // 4-byte IO
  const n4 = readUInt8(buf, offset);
  offset += 1;
  for (let i = 0; i < n4; i += 1) {
    const id = readUInt8(buf, offset);
    offset += 1;
    const value = buf.readUInt32BE(offset);
    offset += 4;
    io.fourByte[id] = value;
  }

  // 8-byte IO
  const n8 = readUInt8(buf, offset);
  offset += 1;
  for (let i = 0; i < n8; i += 1) {
    const id = readUInt8(buf, offset);
    offset += 1;
    const value = buf.readBigUInt64BE(offset).toString();
    offset += 8;
    io.eightByte[id] = value;
  }

  const counted =
    Object.keys(io.oneByte).length +
    Object.keys(io.twoByte).length +
    Object.keys(io.fourByte).length +
    Object.keys(io.eightByte).length;

  if (counted !== totalIoCount) {
    // Teltonika totalIoCount should match; warn via protocol error for safety
    throw new ProtocolError(
      `IO element count mismatch (header ${totalIoCount}, parsed ${counted})`,
      { totalIoCount, counted, recordStart: start }
    );
  }

  return {
    nextOffset: offset,
    record: {
      timestampMs: timestampMs.toString(),
      priority,
      gps: {
        longitude: longitudeRaw / 10000000,
        latitude: latitudeRaw / 10000000,
        longitudeRaw,
        latitudeRaw,
        altitude,
        angle,
        satellites,
        speed,
      },
      io,
    },
  };
}

module.exports = {
  decodeCodec8,
};
