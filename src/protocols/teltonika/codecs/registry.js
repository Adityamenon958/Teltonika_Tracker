'use strict';

const teltonika = require('../../../constants/teltonika');
const { ProtocolError } = require('../../../errors/ProtocolError');
const { ERROR_CODES } = require('../../../constants/errors');
const { decodeCodec8 } = require('./codec8');

/** @type {Map<number, (dataField: Buffer) => { codecId: number, numberOfRecords: number, records: object[] }>} */
const decoders = new Map();

decoders.set(teltonika.CODEC_8, decodeCodec8);

/**
 * ✅ Decode AVL data field using codec ID at byte 0.
 * @param {Buffer} dataField
 */
function decodeAvlDataField(dataField) {
  if (!Buffer.isBuffer(dataField) || dataField.length < 1) {
    throw new ProtocolError('Empty AVL data field');
  }

  const codecId = dataField.readUInt8(0);
  const decoder = decoders.get(codecId);

  if (!decoder) {
    const err = new ProtocolError(
      `No decoder registered for codec 0x${codecId.toString(16)}`,
      { codecId }
    );
    err.code = ERROR_CODES.UNSUPPORTED_CODEC;
    throw err;
  }

  return decoder(dataField);
}

/**
 * @param {number} codecId
 * @param {Function} decoderFn
 */
function registerCodec(codecId, decoderFn) {
  decoders.set(codecId, decoderFn);
}

module.exports = {
  decodeAvlDataField,
  registerCodec,
};
