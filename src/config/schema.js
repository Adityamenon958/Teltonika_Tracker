'use strict';

const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Fail fast if required env vars are missing or invalid.
 * @param {NodeJS.ProcessEnv} env
 */
function validateEnv(env) {
  const missing = [];

  if (!env.MONGODB_URI || String(env.MONGODB_URI).trim() === '') {
    missing.push('MONGODB_URI');
  }

  if (missing.length > 0) {
    throw new AppError(
      `Missing required environment variable(s): ${missing.join(', ')}`,
      ERROR_CODES.CONFIG_INVALID,
      500
    );
  }

  const port = Number(env.TCP_PORT);
  if (env.TCP_PORT !== undefined && env.TCP_PORT !== '' && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    throw new AppError(
      `TCP_PORT must be an integer between 1 and 65535 (got: ${env.TCP_PORT})`,
      ERROR_CODES.CONFIG_INVALID,
      500
    );
  }

  const authMode = (env.IMEI_AUTH_MODE || 'strict').toLowerCase();
  if (!['strict', 'open'].includes(authMode)) {
    throw new AppError(
      `IMEI_AUTH_MODE must be "strict" or "open" (got: ${env.IMEI_AUTH_MODE})`,
      ERROR_CODES.CONFIG_INVALID,
      500
    );
  }
}

module.exports = {
  validateEnv,
};
