'use strict';

const { AppError } = require('./AppError');
const { ProtocolError } = require('./ProtocolError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Connection actions the TCP layer should take after an error.
 */
const ConnectionAction = Object.freeze({
  IGNORE: 'IGNORE',
  REJECT_LOGIN: 'REJECT_LOGIN',
  CLOSE: 'CLOSE',
});

/**
 * @param {unknown} err
 * @param {import('pino').Logger} logger
 * @returns {{ action: string, rejectLogin: boolean }}
 */
function handleConnectionError(err, logger) {
  const log = logger || console;

  if (err instanceof ProtocolError) {
    log.warn({ err: serializeError(err), code: err.code }, err.message);
    return { action: ConnectionAction.CLOSE, rejectLogin: false };
  }

  if (err instanceof AppError) {
    if (err.code === ERROR_CODES.AUTH_REJECTED) {
      log.warn({ err: serializeError(err), code: err.code }, err.message);
      return { action: ConnectionAction.REJECT_LOGIN, rejectLogin: true };
    }

    log.error({ err: serializeError(err), code: err.code }, err.message);
    return { action: ConnectionAction.CLOSE, rejectLogin: false };
  }

  // Programmer / unexpected errors — still isolate to this connection
  log.error({ err: serializeError(err) }, 'Unexpected connection error');
  return { action: ConnectionAction.CLOSE, rejectLogin: false };
}

/**
 * @param {unknown} err
 */
function serializeError(err) {
  if (!err || typeof err !== 'object') {
    return { message: String(err) };
  }
  const e = /** @type {Error & { code?: string, details?: unknown }} */ (err);
  return {
    name: e.name,
    message: e.message,
    code: e.code,
    details: e.details,
    stack: e.stack,
  };
}

module.exports = {
  ConnectionAction,
  handleConnectionError,
  serializeError,
};
