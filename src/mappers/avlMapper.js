'use strict';

const { teltonikaTimestampToDate } = require('../utils/time');

/**
 * ✅ Map decoded Codec 8 protocol records → Dashboard AvlRecord documents.
 *
 * Decoder never knows MongoDB.
 * Models never know Teltonika packets.
 *
 * Output shape matches src/db/models/AvlRecord.js exactly.
 *
 * @param {object[]} protocolRecords from codec8 decoder
 * @param {{
 *   imei: string,
 *   codecId: number,
 *   device: import('mongoose').Types.ObjectId|string,
 *   crcValid?: boolean,
 *   rawHex?: string,
 * }} context
 * @returns {object[]}
 */
function mapCodec8RecordsToAvlDocuments(protocolRecords, context) {
  const { imei, codecId, device, crcValid = true, rawHex } = context;

  if (!imei) {
    throw new Error('avlMapper requires context.imei');
  }
  if (!device) {
    throw new Error('avlMapper requires context.device (Device ObjectId)');
  }
  if (codecId === undefined || codecId === null) {
    throw new Error('avlMapper requires context.codecId');
  }

  const receivedAt = new Date();

  return (protocolRecords || []).map((rec) => {
    const gps = rec.gps || {};

    const doc = {
      device,
      imei: String(imei),
      codecId: Number(codecId),
      priority: Number(rec.priority ?? 0),
      timestamp: teltonikaTimestampToDate(rec.timestampMs),
      longitude: Number(gps.longitude),
      latitude: Number(gps.latitude),
      altitude: Number(gps.altitude ?? 0),
      angle: Number(gps.angle ?? 0),
      satellites: Number(gps.satellites ?? 0),
      speed: Number(gps.speed ?? 0),
      eventIoId: Number(rec.io?.eventIoId ?? 0),
      ioElements: mapIoElements(rec.io),
      crcValid: Boolean(crcValid),
      receivedAt,
    };

    // Optional debug field — only include when provided
    if (typeof rawHex === 'string' && rawHex.length > 0) {
      doc.rawHex = rawHex;
    }

    return doc;
  });
}

/**
 * Convert Codec 8 IO maps → Dashboard ioElementSchema array:
 *   { id: Number, value: Mixed, valueSize: 1|2|4|8 }
 *
 * @param {object} io
 * @returns {Array<{ id: number, value: *, valueSize: number }>}
 */
function mapIoElements(io) {
  if (!io) return [];

  const elements = [];

  appendIoMap(elements, io.oneByte, 1);
  appendIoMap(elements, io.twoByte, 2);
  appendIoMap(elements, io.fourByte, 4);
  appendIoMap(elements, io.eightByte, 8);

  return elements;
}

/**
 * @param {Array<{ id: number, value: *, valueSize: number }>} target
 * @param {object} map
 * @param {number} valueSize
 */
function appendIoMap(target, map, valueSize) {
  if (!map || typeof map !== 'object') return;

  for (const [id, value] of Object.entries(map)) {
    target.push({
      id: Number(id),
      value,
      valueSize,
    });
  }
}

module.exports = {
  mapCodec8RecordsToAvlDocuments,
  mapIoElements,
};
