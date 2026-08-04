'use strict';

const { buildReadRequest } = require('./requestBuilder');
const { parseReadResponse } = require('./responseParser');
const { applyRegisterProfile } = require('./applyProfile');
const { modbusCrc16, appendModbusCrc, verifyModbusCrc } = require('./crc');
const { ModbusError, MODBUS_ERROR } = require('./errors');
const devices = require('./devices');

module.exports = {
  buildReadRequest,
  parseReadResponse,
  applyRegisterProfile,
  modbusCrc16,
  appendModbusCrc,
  verifyModbusCrc,
  ModbusError,
  MODBUS_ERROR,
  devices,
};
