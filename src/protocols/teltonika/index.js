'use strict';

const { tryParseImeiLogin, isValidImeiFormat } = require('./imeiParser');
const { tryConsumeAvlFrame, calculateAvlCrc } = require('./frameParser');
const { buildRecordCountAck, buildLoginResponse } = require('./ackBuilder');
const { decodeAvlDataField, registerCodec } = require('./codecs/registry');
const { decodeCodec8 } = require('./codecs/codec8');
const {
  buildCodec12Packet,
  tryConsumeCodec12Frame,
  calculateCodec12Crc,
} = require('./codecs/codec12');

module.exports = {
  tryParseImeiLogin,
  isValidImeiFormat,
  tryConsumeAvlFrame,
  calculateAvlCrc,
  buildRecordCountAck,
  buildLoginResponse,
  decodeAvlDataField,
  registerCodec,
  decodeCodec8,
  buildCodec12Packet,
  tryConsumeCodec12Frame,
  calculateCodec12Crc,
};
