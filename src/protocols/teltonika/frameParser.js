'use strict';

const { crc16 } = require('crc');
const { ProtocolError } = require('../../errors/ProtocolError');
const teltonika = require('../../constants/teltonika');

/**
 * ✅ Teltonika AVL CRC-16 (IBM/ARC, poly 0xA001) over the data field.
 * @param {Buffer} dataField
 * @returns {number}
 */
function calculateAvlCrc(dataField) {
  return crc16(dataField);
}

/**
 * ✅ Try to consume one complete AVL data packet from a buffer.
 * Packet layout:
 *   preamble(4) + dataFieldLength(4) + dataField(N) + crc(4)
 *
 * @param {Buffer} buffer
 * @returns {{
 *   dataField: Buffer,
 *   dataFieldLength: number,
 *   crc: number,
 *   bytesConsumed: number
 * } | null} null = need more bytes
 */
function tryConsumeAvlFrame(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < teltonika.AVL_HEADER_SIZE) {
    return null;
  }

  const preamble = buffer.readUInt32BE(0);
  if (preamble !== teltonika.AVL_PREAMBLE) {
    throw new ProtocolError(
      `Invalid AVL preamble: 0x${preamble.toString(16).padStart(8, '0')}`,
      { preamble }
    );
  }

  const dataFieldLength = buffer.readUInt32BE(4);

  if (dataFieldLength === 0 || dataFieldLength > teltonika.MAX_DATA_FIELD_LENGTH) {
    throw new ProtocolError(`Invalid AVL data field length: ${dataFieldLength}`, {
      dataFieldLength,
    });
  }

  const totalSize = teltonika.AVL_HEADER_SIZE + dataFieldLength + teltonika.AVL_CRC_SIZE;
  if (buffer.length < totalSize) {
    return null;
  }

  const dataField = buffer.subarray(
    teltonika.AVL_HEADER_SIZE,
    teltonika.AVL_HEADER_SIZE + dataFieldLength
  );

  const crcOffset = teltonika.AVL_HEADER_SIZE + dataFieldLength;
  const crc = buffer.readUInt32BE(crcOffset);
  const expectedCrc = calculateAvlCrc(dataField);

  if (crc !== expectedCrc) {
    throw new ProtocolError(
      `AVL CRC mismatch (got ${crc}, expected ${expectedCrc})`,
      { crc, expectedCrc, dataFieldLength }
    );
  }

  return {
    dataField: Buffer.from(dataField),
    dataFieldLength,
    crc,
    bytesConsumed: totalSize,
  };
}

module.exports = {
  tryConsumeAvlFrame,
  calculateAvlCrc,
};
