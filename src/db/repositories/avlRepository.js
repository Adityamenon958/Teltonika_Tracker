'use strict';

const AvlRecord = require('../models/AvlRecord');
const { AppError } = require('../../errors/AppError');
const { ERROR_CODES } = require('../../constants/errors');

/**
 * ✅ AVL record data access — services must use this, never Model directly.
 * @param {object[]} documents Dashboard-shaped AvlRecord plain objects
 * @returns {Promise<{ insertedCount: number }>}
 */
async function insertMany(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return { insertedCount: 0 };
  }

  try {
    const result = await AvlRecord.insertMany(documents, { ordered: true });
    return { insertedCount: result.length };
  } catch (err) {
    throw new AppError(
      'Failed to insert AVL records',
      ERROR_CODES.DB_ERROR,
      500,
      { cause: err.message, count: documents.length }
    );
  }
}

module.exports = {
  insertMany,
};
