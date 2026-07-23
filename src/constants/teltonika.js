'use strict';

/**
 * ✅ Teltonika protocol constants (facts, not env).
 */
module.exports = Object.freeze({
  LOGIN_ACCEPT: 0x01,
  LOGIN_REJECT: 0x00,

  /** AVL data packet preamble (4 zero bytes) */
  AVL_PREAMBLE: 0x00000000,

  CODEC_8: 0x08,
  CODEC_8_EXTENDED: 0x8e,
  CODEC_16: 0x10,

  /** Typical IMEI length in digits */
  IMEI_MIN_LENGTH: 15,
  IMEI_MAX_LENGTH: 16,

  /** Max reasonable IMEI length field from device */
  IMEI_LENGTH_FIELD_MAX: 16,

  /** Header before AVL data field: preamble(4) + dataFieldLength(4) */
  AVL_HEADER_SIZE: 8,

  /** Trailer after data field: CRC-16 stored in 4 bytes */
  AVL_CRC_SIZE: 4,

  /** ACK is 4-byte big-endian record count */
  ACK_SIZE: 4,

  /** Absolute max data field length we will accept */
  MAX_DATA_FIELD_LENGTH: 512 * 1024,
});
