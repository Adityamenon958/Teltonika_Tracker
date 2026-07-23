'use strict';

const deviceRepository = require('../db/repositories/deviceRepository');
const { isValidImeiFormat } = require('../protocols/teltonika/imeiParser');
const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Authenticate device by IMEI.
 * @param {string} imei
 * @param {{ imeiAuthMode: 'strict'|'open' }} config
 * @returns {Promise<{ accepted: boolean, device: object|null, reason?: string }>}
 */
async function authenticateImei(imei, config) {
  if (!isValidImeiFormat(imei)) {
    throw new AppError(`Invalid IMEI format: ${imei}`, ERROR_CODES.AUTH_REJECTED, 401, {
      imei,
    });
  }

  const mode = config.imeiAuthMode || 'strict';

  if (mode === 'open') {
    return { accepted: true, device: null, reason: 'open_mode' };
  }

  const device = await deviceRepository.findByImei(imei);
  if (!device) {
    return { accepted: false, device: null, reason: 'unknown_imei' };
  }

  // If Dashboard has an active/enabled flag, enforce it here after schema paste.
  if (device.active === false || device.enabled === false || device.isActive === false) {
    return { accepted: false, device, reason: 'device_disabled' };
  }

  return { accepted: true, device, reason: 'ok' };
}

module.exports = {
  authenticateImei,
};
