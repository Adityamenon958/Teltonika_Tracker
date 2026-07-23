'use strict';

const { ProtocolError } = require('../../errors/ProtocolError');
const teltonika = require('../../constants/teltonika');

/**
 * ✅ Parse Teltonika IMEI login packet.
 * Format: [2 bytes BE length][IMEI ASCII]
 *
 * @param {Buffer} buffer
 * @returns {{ imei: string, bytesConsumed: number } | null}
 *   null = need more bytes
 */
function tryParseImeiLogin(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) {
    return null;
  }

  const imeiLength = buffer.readUInt16BE(0);

  if (imeiLength === 0 || imeiLength > teltonika.IMEI_LENGTH_FIELD_MAX) {
    throw new ProtocolError(`Invalid IMEI length field: ${imeiLength}`, {
      imeiLength,
    });
  }

  // Not an IMEI login if this looks like AVL preamble (0x00000000)
  // IMEI length for 15-digit IMEI is 0x000F — fine.
  // If first 4 bytes are 0x00000000, it's AVL data, not IMEI.
  if (buffer.length >= 4 && buffer.readUInt32BE(0) === teltonika.AVL_PREAMBLE) {
    throw new ProtocolError('Expected IMEI login packet, got AVL preamble');
  }

  const total = 2 + imeiLength;
  if (buffer.length < total) {
    return null;
  }

  const imei = buffer.subarray(2, total).toString('ascii').trim();

  if (!/^\d{15,16}$/.test(imei)) {
    throw new ProtocolError(`Invalid IMEI format: ${imei}`, { imei });
  }

  return { imei, bytesConsumed: total };
}

/**
 * @param {string} imei
 * @returns {boolean}
 */
function isValidImeiFormat(imei) {
  return /^\d{15,16}$/.test(String(imei || '').trim());
}

module.exports = {
  tryParseImeiLogin,
  isValidImeiFormat,
};
