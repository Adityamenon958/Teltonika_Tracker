'use strict';

const { MODBUS_ERROR } = require('../protocols/modbus/errors');

/**
 * ✅ Milestone 1 live verify helper — event-driven (post-auth only).
 * Does not touch AVL, Codec 8/12 parsers, registry, or Modbus queue internals.
 */

/**
 * Map Modbus/transport errors to a short human reason for live-verify logs.
 * @param {Error} err
 * @returns {string}
 */
function liveFailureReason(err) {
  if (!err) return 'unknown';

  const code = err.code;
  const msg = String(err.message || '').toLowerCase();

  if (code === MODBUS_ERROR.TIMEOUT || msg.includes('timeout')) return 'timeout';
  if (code === MODBUS_ERROR.OFFLINE) {
    if (msg.includes('no socket') || msg.includes('failed to write')) return 'no socket';
    return 'tracker offline';
  }
  if (code === MODBUS_ERROR.CRC || msg.includes('crc')) return 'CRC failure';
  if (code === MODBUS_ERROR.EXCEPTION || msg.includes('exception')) return 'Modbus exception';
  if (code === MODBUS_ERROR.FUNCTION_MISMATCH) return 'unsupported response';
  if (code === MODBUS_ERROR.SLAVE_MISMATCH) return 'unexpected slave ID';
  if (code === MODBUS_ERROR.CODEC12) return 'Codec 12 failure';
  if (code === MODBUS_ERROR.LENGTH) return 'unsupported response';
  if (msg.includes('offline')) return 'tracker offline';
  if (msg.includes('socket')) return 'no socket';

  return err.message || 'unknown';
}

/**
 * After IMEI auth + registry.add: if env IMEI matches, schedule one live Frequency read.
 *
 * @param {{
 *   imei: string,
 *   connectionId: string,
 *   modbusSession: import('./modbusSessionService').ModbusSessionService | null,
 *   logger: object,
 *   delayMs?: number,
 * }} opts
 * @returns {NodeJS.Timeout | null} timer handle (caller may clear on disconnect)
 */
function scheduleLiveModbusReadAfterAuth(opts) {
  const target = process.env.MODBUS_LIVE_READ_IMEI;
  if (!target || !String(target).trim()) {
    return null;
  }

  const imei = String(opts.imei);
  if (String(target).trim() !== imei) {
    return null;
  }

  if (!opts.modbusSession || typeof opts.modbusSession.readConfiguredRegister !== 'function') {
    opts.logger.warn({ imei }, 'Live Modbus read skipped — modbusSession not wired');
    return null;
  }

  const delayMs = Number(
    process.env.MODBUS_LIVE_READ_DELAY_MS || opts.delayMs || 4000
  );

  opts.logger.info({ imei, delayMs, connectionId: opts.connectionId }, 'Scheduling live Modbus read');

  const timer = setTimeout(async () => {
    try {
      opts.logger.info({ imei }, 'Sending Codec12 Modbus request');

      const result = await opts.modbusSession.readConfiguredRegister(imei, 'pm2140', 'frequency');

      opts.logger.info(
        {
          imei,
          durationMs: result.durationMs,
          rawWords: result.rawWords,
          rawModbusHex: result.rawModbusHex,
        },
        'Codec12 response received'
      );

      opts.logger.info(
        {
          imei,
          name: result.name,
          value: result.value,
          unit: result.unit,
          rawWords: result.rawWords,
        },
        'Decoded Frequency'
      );

      opts.logger.info(
        {
          imei,
          value: result.value,
          unit: result.unit,
          durationMs: result.durationMs,
        },
        'Live Modbus read completed'
      );
    } catch (err) {
      const reason = liveFailureReason(err);
      opts.logger.error(
        {
          imei,
          reason,
          code: err.code,
          err: err.message,
        },
        'Live Modbus read failed'
      );
    }
  }, delayMs);

  // Do not keep process alive solely for this one-shot verify timer
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return timer;
}

module.exports = {
  scheduleLiveModbusReadAfterAuth,
  liveFailureReason,
};
