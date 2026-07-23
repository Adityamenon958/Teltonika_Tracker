'use strict';

const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Base operational error — safe to handle without crashing the process.
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   * @param {number} [statusCode]
   * @param {object} [details]
   */
  constructor(message, code = ERROR_CODES.INTERNAL, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = {
  AppError,
};
