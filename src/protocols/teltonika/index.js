'use strict';

const { tryParseImeiLogin, isValidImeiFormat } = require('./imeiParser');
const { tryConsumeAvlFrame, calculateAvlCrc } = require('./frameParser');
const { buildRecordCountAck, buildLoginResponse } = require('./ackBuilder');
const { decodeAvlDataField, registerCodec } = require('./codecs/registry');
const { decodeCodec8 } = require('./codecs/codec8');

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
};
