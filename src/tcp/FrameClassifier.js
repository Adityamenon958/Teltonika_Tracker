'use strict';

const teltonika = require('../constants/teltonika');

/**
 * ✅ Peek-only frame classification. Does not parse AVL records or Codec 12 payloads.
 *
 * Priority: when both could apply, callers process AVL first (plan guarantee).
 * This helper reports what the next complete-or-partial frame looks like.
 *
 * @param {Buffer} buffer
 * @returns {'NEED_MORE'|'IMEI'|'AVL'|'CODEC12'|'UNKNOWN'}
 */
function classifyFrame(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) {
    return 'NEED_MORE';
  }

  // Codec 12 and AVL both start with 4 zero preamble bytes when full header present.
  // Distinguish by Codec ID at offset 8 once we have at least 9 bytes.
  if (buffer.length >= 9) {
    const preamble = buffer.readUInt32BE(0);
    if (preamble === teltonika.AVL_PREAMBLE) {
      const codecId = buffer.readUInt8(8);
      if (codecId === teltonika.CODEC_12) {
        return 'CODEC12';
      }
      if (codecId === teltonika.CODEC_8 || codecId === teltonika.CODEC_8_EXTENDED || codecId === teltonika.CODEC_16) {
        return 'AVL';
      }
      // Unknown codec after AVL-style preamble — treat as AVL path for error handling
      return 'AVL';
    }
  }

  // Partial header that looks like zero preamble
  if (buffer.length >= 4) {
    const preamble = buffer.readUInt32BE(0);
    if (preamble === teltonika.AVL_PREAMBLE) {
      return 'NEED_MORE';
    }
  } else if (buffer.length > 0) {
    // Could still become preamble 00 00 00 00
    let allZero = true;
    for (let i = 0; i < buffer.length; i += 1) {
      if (buffer[i] !== 0x00) {
        allZero = false;
        break;
      }
    }
    if (allZero) return 'NEED_MORE';
  }

  // IMEI login: length-prefixed ASCII (not zero preamble)
  // First two bytes are length; if first 4 are not preamble, likely IMEI
  if (buffer.length >= 2) {
    const len = buffer.readUInt16BE(0);
    if (len > 0 && len <= teltonika.IMEI_LENGTH_FIELD_MAX) {
      return 'IMEI';
    }
  }

  return 'UNKNOWN';
}

/**
 * Prefer AVL when a complete AVL frame is available; otherwise Codec12 if complete.
 * Used by ConnectionHandler drain loop for AVL-first priority.
 *
 * @param {Buffer} buffer
 * @param {{ tryConsumeAvlFrame: Function, tryConsumeCodec12Frame: Function }} parsers
 * @returns {'AVL'|'CODEC12'|'NEED_MORE'|'UNKNOWN'}
 */
function classifyNextAction(buffer, parsers) {
  const kind = classifyFrame(buffer);

  if (kind === 'NEED_MORE' || kind === 'IMEI' || kind === 'UNKNOWN') {
    return kind === 'IMEI' ? 'IMEI' : kind;
  }

  if (kind === 'AVL') {
    const avl = parsers.tryConsumeAvlFrame(buffer);
    if (avl) return 'AVL';
    // Incomplete AVL — do not steal bytes as Codec12
    return 'NEED_MORE';
  }

  if (kind === 'CODEC12') {
    const c12 = parsers.tryConsumeCodec12Frame(buffer);
    if (c12) return 'CODEC12';
    return 'NEED_MORE';
  }

  return 'UNKNOWN';
}

module.exports = {
  classifyFrame,
  classifyNextAction,
};
