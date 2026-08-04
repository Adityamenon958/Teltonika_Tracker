'use strict';

const { crc16 } = require('crc');
const { ProtocolError } = require('../../../errors/ProtocolError');
const teltonika = require('../../../constants/teltonika');

/**
 * ✅ Teltonika Codec 12 — command/response envelopes (no Modbus knowledge).
 *
 * Command (server → device):
 *   preamble(4) + dataSize(4) + codecId(1) + qty1(1) + type(1) + cmdSize(4) + payload(X) + qty2(1) + crc(4)
 *
 * Response (device → server): same layout; type typically 0x06.
 */

function calculateCodec12Crc(dataFromCodecIdThroughQty2) {
  return crc16(dataFromCodecIdThroughQty2);
}

/**
 * @param {Buffer} payload
 * @param {number} type - e.g. TYPE_SERIAL_FORWARD 0x0E or TYPE_COMMAND 0x05
 * @returns {Buffer}
 */
function buildCodec12Packet(payload, type) {
  if (!Buffer.isBuffer(payload)) {
    throw new ProtocolError('Codec 12 payload must be a Buffer');
  }
  if (typeof type !== 'number') {
    throw new ProtocolError('Codec 12 type must be a number');
  }

  const quantity = 1;
  // dataSize = codecId(1)+qty1(1)+type(1)+cmdSize(4)+payload+qty2(1)
  const dataSize = 1 + 1 + 1 + 4 + payload.length + 1;

  const body = Buffer.alloc(dataSize);
  let o = 0;
  body.writeUInt8(teltonika.CODEC_12, o); o += 1;
  body.writeUInt8(quantity, o); o += 1;
  body.writeUInt8(type & 0xff, o); o += 1;
  body.writeUInt32BE(payload.length >>> 0, o); o += 4;
  payload.copy(body, o); o += payload.length;
  body.writeUInt8(quantity, o); o += 1;

  const crcVal = calculateCodec12Crc(body);
  const packet = Buffer.alloc(4 + 4 + dataSize + 4);
  packet.writeUInt32BE(0, 0);
  packet.writeUInt32BE(dataSize >>> 0, 4);
  body.copy(packet, 8);
  packet.writeUInt32BE(crcVal >>> 0, 8 + dataSize);

  return packet;
}

/**
 * Try to consume one complete Codec 12 frame.
 * @param {Buffer} buffer
 * @returns {{ type: number, payload: Buffer, quantity: number, bytesConsumed: number, crc: number } | null}
 */
function tryConsumeCodec12Frame(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 + 1 + 1 + 1 + 4 + 1 + 4) {
    // min: preamble+size+codec+qty+type+cmdSize(0)+qty2+crc — allow short and return null
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
      return null;
    }
  }

  if (buffer.length < 8) {
    return null;
  }

  const preamble = buffer.readUInt32BE(0);
  if (preamble !== teltonika.AVL_PREAMBLE) {
    throw new ProtocolError(
      `Invalid Codec 12 preamble: 0x${preamble.toString(16).padStart(8, '0')}`,
      { preamble }
    );
  }

  const dataSize = buffer.readUInt32BE(4);
  if (dataSize < 8 || dataSize > teltonika.MAX_DATA_FIELD_LENGTH) {
    throw new ProtocolError(`Invalid Codec 12 data size: ${dataSize}`, { dataSize });
  }

  const totalSize = 8 + dataSize + 4;
  if (buffer.length < totalSize) {
    return null;
  }

  const body = buffer.subarray(8, 8 + dataSize);
  const codecId = body.readUInt8(0);
  if (codecId !== teltonika.CODEC_12) {
    throw new ProtocolError(`Expected Codec 12 (0x0C), got 0x${codecId.toString(16)}`, {
      codecId,
    });
  }

  let o = 1;
  const quantity1 = body.readUInt8(o); o += 1;
  const type = body.readUInt8(o); o += 1;
  const commandSize = body.readUInt32BE(o); o += 4;

  if (commandSize > body.length - o - 1) {
    throw new ProtocolError('Codec 12 command size exceeds data field', {
      commandSize,
      remaining: body.length - o - 1,
    });
  }

  const payload = Buffer.from(body.subarray(o, o + commandSize));
  o += commandSize;
  const quantity2 = body.readUInt8(o); o += 1;

  if (o !== dataSize) {
    throw new ProtocolError('Codec 12 data field length mismatch', {
      consumed: o,
      dataSize,
    });
  }

  const crcStored = buffer.readUInt32BE(8 + dataSize);
  const crcExpected = calculateCodec12Crc(body);
  if (crcStored !== crcExpected) {
    throw new ProtocolError(
      `Codec 12 CRC mismatch (got ${crcStored}, expected ${crcExpected})`,
      { crcStored, crcExpected }
    );
  }

  return {
    type,
    payload,
    quantity: quantity1,
    quantity2,
    bytesConsumed: totalSize,
    crc: crcStored,
  };
}

module.exports = {
  buildCodec12Packet,
  tryConsumeCodec12Frame,
  calculateCodec12Crc,
};
