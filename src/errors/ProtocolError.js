'use strict';

const { AppError } = require('./AppError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Malformed / unsupported Teltonika packets.
 */
class ProtocolError extends AppError {
  /**
   * @param {string} message
   * @param {object} [details]
   */
  constructor(message, details = undefined) {
    super(message, ERROR_CODES.PROTOCOL_ERROR, 400, details);
    this.name = 'ProtocolError';
  }
}

module.exports = {
  ProtocolError,
};
