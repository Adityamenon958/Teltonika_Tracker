'use strict';

const teltonika = require('../../constants/teltonika');

/**
 * ✅ Build 4-byte big-endian ACK with number of AVL records received.
 * @param {number} recordCount
 * @returns {Buffer}
 */
function buildRecordCountAck(recordCount) {
  const count = Number(recordCount);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid ACK record count: ${recordCount}`);
  }

  const buf = Buffer.alloc(teltonika.ACK_SIZE);
  buf.writeUInt32BE(count >>> 0, 0);
  return buf;
}

/**
 * ✅ Single-byte IMEI login response.
 * @param {boolean} accepted
 * @returns {Buffer}
 */
function buildLoginResponse(accepted) {
  return Buffer.from([accepted ? teltonika.LOGIN_ACCEPT : teltonika.LOGIN_REJECT]);
}

module.exports = {
  buildRecordCountAck,
  buildLoginResponse,
};
