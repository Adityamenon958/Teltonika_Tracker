'use strict';

/**
 * ✅ Small binary read helpers for protocol parsing.
 */

function readUInt8(buffer, offset) {
  return buffer.readUInt8(offset);
}

function readUInt16BE(buffer, offset) {
  return buffer.readUInt16BE(offset);
}

function readInt16BE(buffer, offset) {
  return buffer.readInt16BE(offset);
}

function readUInt32BE(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function readInt32BE(buffer, offset) {
  return buffer.readInt32BE(offset);
}

function readUInt64BE(buffer, offset) {
  // Node 12+ : readBigUInt64BE
  return buffer.readBigUInt64BE(offset);
}

function readInt64BE(buffer, offset) {
  return buffer.readBigInt64BE(offset);
}

module.exports = {
  readUInt8,
  readUInt16BE,
  readInt16BE,
  readUInt32BE,
  readInt32BE,
  readUInt64BE,
  readInt64BE,
};
