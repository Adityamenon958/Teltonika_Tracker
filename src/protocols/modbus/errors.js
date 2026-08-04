'use strict';

const { AppError } = require('../../errors/AppError');
const { ERROR_CODES } = require('../../constants/errors');

const MODBUS_ERROR = Object.freeze({
  CRC: 'MODBUS_CRC',
  EXCEPTION: 'MODBUS_EXCEPTION',
  LENGTH: 'MODBUS_LENGTH',
  SLAVE_MISMATCH: 'MODBUS_SLAVE_MISMATCH',
  FUNCTION_MISMATCH: 'MODBUS_FUNCTION_MISMATCH',
  TIMEOUT: 'MODBUS_TIMEOUT',
  OFFLINE: 'MODBUS_TRACKER_OFFLINE',
  CODEC12: 'MODBUS_CODEC12',
});

class ModbusError extends AppError {
  /**
   * @param {string} message
   * @param {string} code
   * @param {object} [details]
   * @param {boolean} [retryable]
   */
  constructor(message, code, details = undefined, retryable = false) {
    super(message, code || ERROR_CODES.PROTOCOL_ERROR, 400, details);
    this.name = 'ModbusError';
    this.retryable = retryable;
  }
}

module.exports = {
  MODBUS_ERROR,
  ModbusError,
};
