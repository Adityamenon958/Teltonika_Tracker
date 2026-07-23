'use strict';

const { mapCodec8RecordsToAvlDocuments } = require('../mappers/avlMapper');
const { validateAvlRecords } = require('../validation/avlRecordValidator');
const avlRepository = require('../db/repositories/avlRepository');
const deviceRepository = require('../db/repositories/deviceRepository');
const { getLogger } = require('../logger');
const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Ingest decoded Codec 8 records: resolve device → map → validate → persist.
 * Returns number of records successfully stored (for ACK).
 *
 * @param {{
 *   imei: string,
 *   codecId: number,
 *   records: object[],
 *   crcValid?: boolean,
 *   rawHex?: string,
 *   touchLastSeen?: boolean
 * }} payload
 * @returns {Promise<{ storedCount: number }>}
 */
async function ingestAvlRecords(payload) {
  const logger = getLogger();
  const {
    imei,
    codecId,
    records,
    crcValid = true,
    rawHex,
    touchLastSeen = true,
  } = payload;

  // AvlRecord.device is required (Dashboard schema) — resolve Device._id by IMEI
  const deviceDoc = await deviceRepository.findByImei(imei);
  if (!deviceDoc || !deviceDoc._id) {
    throw new AppError(
      `Cannot ingest AVL: no Device found for IMEI ${imei}`,
      ERROR_CODES.AUTH_REJECTED,
      401,
      { imei }
    );
  }

  const documents = mapCodec8RecordsToAvlDocuments(records, {
    imei,
    codecId,
    device: deviceDoc._id,
    crcValid,
    rawHex,
  });

  validateAvlRecords(documents);

  const { insertedCount } = await avlRepository.insertMany(documents);

  if (touchLastSeen && insertedCount > 0) {
    try {
      await deviceRepository.touchLastSeen(imei);
    } catch (err) {
      // Non-fatal: AVL data already stored; lastSeen is best-effort
      logger.warn({ err, imei }, 'Failed to touch device lastSeen');
    }
  }

  logger.info(
    { imei, codecId, deviceId: String(deviceDoc._id), storedCount: insertedCount },
    'AVL records persisted'
  );

  return { storedCount: insertedCount };
}

module.exports = {
  ingestAvlRecords,
};
