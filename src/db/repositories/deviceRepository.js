'use strict';

const Device = require('../models/Device');
const { AppError } = require('../../errors/AppError');
const { ERROR_CODES } = require('../../constants/errors');

/**
 * ✅ Device data access — services must use this, never Model directly.
 */
async function findByImei(imei) {
  try {
    return await Device.findOne({ imei: String(imei).trim() }).lean();
  } catch (err) {
    throw new AppError(
      `Device lookup failed for IMEI ${imei}`,
      ERROR_CODES.DB_ERROR,
      500,
      { cause: err.message }
    );
  }
}

/**
 * Optional last-seen touch — only call if Dashboard schema has these fields.
 * Uses updateOne with $set so unknown fields are harmless if schema allows.
 * @param {string} imei
 * @param {Date} [at]
 */
async function touchLastSeen(imei, at = new Date()) {
  try {
    await Device.updateOne(
      { imei: String(imei).trim() },
      {
        $set: {
          lastSeenAt: at,
          updatedAt: at,
        },
      }
    );
  } catch (err) {
    throw new AppError(
      `Failed to touch lastSeen for IMEI ${imei}`,
      ERROR_CODES.DB_ERROR,
      500,
      { cause: err.message }
    );
  }
}

module.exports = {
  findByImei,
  touchLastSeen,
};
