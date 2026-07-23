'use strict';

const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Validate mapped Dashboard AvlRecord objects before DB write.
 * Mirrors required fields in src/db/models/AvlRecord.js.
 *
 * @param {object[]} documents
 */
function validateAvlRecords(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new AppError('No AVL records to validate', ERROR_CODES.VALIDATION_FAILED);
  }

  for (let i = 0; i < documents.length; i += 1) {
    const doc = documents[i];
    const prefix = `AVL[${i}]`;

    if (!doc || typeof doc !== 'object') {
      throw new AppError(`${prefix} is not an object`, ERROR_CODES.VALIDATION_FAILED);
    }

    if (!doc.device) {
      throw new AppError(`${prefix} missing required device ObjectId`, ERROR_CODES.VALIDATION_FAILED);
    }

    if (!doc.imei || !/^\d{15,16}$/.test(String(doc.imei))) {
      throw new AppError(`${prefix} invalid imei`, ERROR_CODES.VALIDATION_FAILED, 400, {
        imei: doc.imei,
      });
    }

    const requiredNumbers = [
      'codecId',
      'priority',
      'longitude',
      'latitude',
      'altitude',
      'angle',
      'satellites',
      'speed',
    ];

    for (const key of requiredNumbers) {
      if (typeof doc[key] !== 'number' || Number.isNaN(doc[key])) {
        throw new AppError(
          `${prefix} missing or invalid required number field: ${key}`,
          ERROR_CODES.VALIDATION_FAILED,
          400,
          { [key]: doc[key] }
        );
      }
    }

    const ts = doc.timestamp instanceof Date ? doc.timestamp : new Date(doc.timestamp);
    if (Number.isNaN(ts.getTime())) {
      throw new AppError(`${prefix} invalid timestamp`, ERROR_CODES.VALIDATION_FAILED);
    }

    if (doc.latitude < -90 || doc.latitude > 90) {
      throw new AppError(`${prefix} latitude out of range`, ERROR_CODES.VALIDATION_FAILED, 400, {
        latitude: doc.latitude,
      });
    }

    if (doc.longitude < -180 || doc.longitude > 180) {
      throw new AppError(`${prefix} longitude out of range`, ERROR_CODES.VALIDATION_FAILED, 400, {
        longitude: doc.longitude,
      });
    }

    if (!Array.isArray(doc.ioElements)) {
      throw new AppError(`${prefix} ioElements must be an array`, ERROR_CODES.VALIDATION_FAILED);
    }

    for (let j = 0; j < doc.ioElements.length; j += 1) {
      const el = doc.ioElements[j];
      if (
        !el ||
        typeof el.id !== 'number' ||
        el.value === undefined ||
        typeof el.valueSize !== 'number'
      ) {
        throw new AppError(
          `${prefix} ioElements[${j}] must be { id, value, valueSize }`,
          ERROR_CODES.VALIDATION_FAILED
        );
      }
    }
  }

  return true;
}

module.exports = {
  validateAvlRecords,
};
