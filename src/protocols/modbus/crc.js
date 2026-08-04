'use strict';

/**
 * ✅ Modbus RTU CRC-16 (poly 0xA001, init 0xFFFF).
 * Distinct from Teltonika Codec CRC-16/IBM.
 */

/**
 * @param {Buffer} buffer - bytes excluding CRC
 * @returns {number} 16-bit CRC
 */
function modbusCrc16(buffer) {
  let crc = 0xffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let b = 0; b < 8; b += 1) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc & 0xffff;
}

/**
 * Append low-byte-first Modbus CRC to a PDU buffer.
 * @param {Buffer} pduWithoutCrc
 * @returns {Buffer}
 */
function appendModbusCrc(pduWithoutCrc) {
  const crc = modbusCrc16(pduWithoutCrc);
  const out = Buffer.alloc(pduWithoutCrc.length + 2);
  pduWithoutCrc.copy(out, 0);
  out.writeUInt16LE(crc, pduWithoutCrc.length);
  return out;
}

/**
 * @param {Buffer} frameWithCrc
 * @returns {boolean}
 */
function verifyModbusCrc(frameWithCrc) {
  if (!Buffer.isBuffer(frameWithCrc) || frameWithCrc.length < 3) {
    return false;
  }
  const body = frameWithCrc.subarray(0, frameWithCrc.length - 2);
  const stored = frameWithCrc.readUInt16LE(frameWithCrc.length - 2);
  return stored === modbusCrc16(body);
}

module.exports = {
  modbusCrc16,
  appendModbusCrc,
  verifyModbusCrc,
};
