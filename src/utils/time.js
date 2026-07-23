'use strict';

/**
 * ✅ Teltonika timestamps are milliseconds since Unix epoch.
 * @param {bigint|number|string} ms
 * @returns {Date}
 */
function teltonikaTimestampToDate(ms) {
  const n = typeof ms === 'bigint' ? Number(ms) : Number(ms);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid Teltonika timestamp: ${ms}`);
  }
  return new Date(n);
}

/**
 * @param {Date|string|number} value
 * @returns {Date}
 */
function toDate(value) {
  if (value instanceof Date) return value;
  return new Date(value);
}

module.exports = {
  teltonikaTimestampToDate,
  toDate,
};
