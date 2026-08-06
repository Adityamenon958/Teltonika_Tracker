'use strict';

const { buildReadRequest } = require('../protocols/modbus/requestBuilder');
const { parseReadResponse } = require('../protocols/modbus/responseParser');
const { applyRegisterProfile } = require('../protocols/modbus/applyProfile');
const { ModbusError, MODBUS_ERROR } = require('../protocols/modbus/errors');
const { getRegisterDefinition } = require('../protocols/modbus/devices');
const { buildCodec12Packet } = require('../protocols/teltonika/codecs/codec12');
const teltonika = require('../constants/teltonika');
const { ModbusQueue } = require('./modbusQueue');
const { getLogger } = require('../logger');

/**
 * ✅ Internal Modbus façade over Codec 12 Type 0x0E.
 * Does not touch AVL/IMEI paths. One in-flight request per IMEI via queue.
 */
class ModbusSessionService {
  /**
   * @param {{
   *   registry: import('../tcp/ConnectionRegistry').ConnectionRegistry,
   *   config: object,
   * }} deps
   */
  constructor(deps) {
    this.registry = deps.registry;
    this.config = deps.config;
    this.queue = new ModbusQueue();
    this.queue.maxDepth = deps.config.modbus?.queueMaxPerImei || 50;

    /** @type {Map<string, { resolve: Function, reject: Function, timer: NodeJS.Timeout, sentAt: number }>} */
    this._pending = new Map();

    this.logger = getLogger().child({ component: 'modbusSession' });
  }

  /**
   * Deliver inbound Codec 12 Type 0x06 payload to waiter (if any).
   * Never disconnects tracker.
   * @param {string} imei
   * @param {Buffer} payload
   * @param {{ rawCodec12Hex?: string }} [meta]
   */
  handleInbound(imei, payload, meta = {}) {
    const key = String(imei);
    const pending = this._pending.get(key);
    if (!pending) {
      this.logger.warn({ imei: key }, 'Late or unexpected Codec 12 Modbus payload dropped');
      return;
    }

    if (!Buffer.isBuffer(payload)) {
      this.failPending(
        key,
        new ModbusError('Invalid Modbus payload', MODBUS_ERROR.CODEC12, undefined, true)
      );
      return;
    }

    clearTimeout(pending.timer);
    this._pending.delete(key);

    if (this.config.modbus?.debug) {
      this.logger.debug(
        {
          imei: key,
          inboundModbusHex: payload.toString('hex'),
          inboundCodec12Hex: meta.rawCodec12Hex,
          durationMs: Date.now() - pending.sentAt,
        },
        'Modbus debug inbound'
      );
    }

    pending.resolve(payload);
  }

  /**
   * Fail in-flight Modbus waiter without closing the TCP socket.
   * @param {string} imei
   * @param {Error} err
   */
  failPending(imei, err) {
    const key = String(imei);
    const pending = this._pending.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this._pending.delete(key);
    pending.reject(err);
  }

  /**
   * Notify waiters that socket is gone (real disconnect only).
   * @param {string} imei
   */
  notifySocketClosed(imei) {
    const key = String(imei);
    const pending = this._pending.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this._pending.delete(key);
    pending.reject(
      new ModbusError('Tracker socket closed during Modbus wait', MODBUS_ERROR.OFFLINE)
    );
  }

  /**
   * Generic register read — transport API.
   * @param {string} imei
   * @param {number} slaveId
   * @param {number} functionCode
   * @param {number} registerAddress
   * @param {number} registerCount
   * @param {{ registerDef?: object }} [options] - optional profile for scaling
   */
  readRegister(imei, slaveId, functionCode, registerAddress, registerCount, options = {}) {
    return this.queue.enqueue(imei, () =>
      this._readRegisterAttempt(imei, slaveId, functionCode, registerAddress, registerCount, options)
    );
  }

  /**
   * Profile-driven helper.
   * @param {string} imei
   * @param {string} profileId
   * @param {string} registerKey
   * @param {{ slaveId?: number }} [options]
   */
  async readConfiguredRegister(imei, profileId, registerKey, options = {}) {
    const def = getRegisterDefinition(profileId, registerKey);
    const slaveId = options.slaveId ?? require('../protocols/modbus/devices').getDeviceProfile(profileId).defaultSlaveId;

    const result = await this.readRegister(
      imei,
      slaveId,
      def.functionCode,
      def.protocolAddress,
      def.registerCount,
      { registerDef: def }
    );

    return result;
  }

  /**
   * @private
   */
  async _readRegisterAttempt(imei, slaveId, functionCode, registerAddress, registerCount, options) {
    const maxRetries = this.config.modbus?.maxRetries ?? 1;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await this._executeOnce(
          imei,
          slaveId,
          functionCode,
          registerAddress,
          registerCount,
          options,
          attempt
        );
      } catch (err) {
        lastError = err;
        const retryable =
          err instanceof ModbusError
            ? err.retryable === true ||
              err.code === MODBUS_ERROR.TIMEOUT ||
              err.code === MODBUS_ERROR.CRC ||
              err.code === MODBUS_ERROR.CODEC12
            : false;

        // Exceptions / illegal: no retry
        if (err instanceof ModbusError && err.code === MODBUS_ERROR.EXCEPTION) {
          throw err;
        }
        if (err instanceof ModbusError && err.code === MODBUS_ERROR.OFFLINE) {
          throw err;
        }

        if (!retryable || attempt >= maxRetries) {
          throw err;
        }

        this.logger.warn(
          { imei, attempt: attempt + 1, err: err.message, code: err.code },
          'Modbus request retry'
        );
      }
    }

    throw lastError;
  }

  /**
   * @private
   */
  async _executeOnce(imei, slaveId, functionCode, registerAddress, registerCount, options, attempt) {
    const key = String(imei);
    const entry = this.registry.get(key);
    if (!entry || !entry.socket || entry.socket.destroyed) {
      throw new ModbusError(
        `Tracker offline or no socket for IMEI ${key}`,
        MODBUS_ERROR.OFFLINE
      );
    }

    // ✅ Temporary diagnostic only: MODBUS_DEBUG_FORCE_LENGTH overrides quantity for buildReadRequest.
    // Unset the env var to restore original behavior. Does not change profile files or transport.
    let requestRegisterCount = registerCount;
    const forceLengthRaw = process.env.MODBUS_DEBUG_FORCE_LENGTH;
    const forceOverrideActive =
      forceLengthRaw !== undefined && String(forceLengthRaw).trim() !== '';
    if (forceOverrideActive) {
      const forced = Number(forceLengthRaw);
      if (Number.isInteger(forced) && forced >= 1 && forced <= 125) {
        requestRegisterCount = forced;
      }
    }

    const modbusFrame = buildReadRequest({
      slaveId,
      functionCode,
      registerAddress,
      registerCount: requestRegisterCount,
    });

    if (forceOverrideActive) {
      this.logger.info(
        {
          originalQuantity: registerCount,
          forcedQuantity: requestRegisterCount,
          finalRtuRequest: modbusFrame.toString('hex'),
          slaveId,
          functionCode,
          registerAddress,
        },
        '------------------------------------------------\n' +
          'DEBUG OVERRIDE ENABLED\n' +
          `Original Quantity: ${registerCount}\n` +
          `Forced Quantity: ${requestRegisterCount}\n` +
          `Final RTU Request: ${modbusFrame.toString('hex')}\n` +
          '------------------------------------------------'
      );
    }

    const codec12Packet = buildCodec12Packet(modbusFrame, teltonika.TYPE_SERIAL_FORWARD);
    const timeoutMs = this.config.modbus?.responseTimeoutMs ?? 8000;
    const sentAt = Date.now();

    this.logger.info(
      {
        imei: key,
        slaveId,
        functionCode,
        registerAddress,
        registerCount,
        attempt,
      },
      'Modbus readRegister start'
    );

    if (this.config.modbus?.debug) {
      this.logger.debug(
        {
          imei: key,
          outboundModbusHex: modbusFrame.toString('hex'),
          outboundCodec12Hex: codec12Packet.toString('hex'),
        },
        'Modbus debug outbound'
      );
    }

    const responsePayload = await new Promise((resolve, reject) => {
      if (this._pending.has(key)) {
        reject(new ModbusError('Modbus request already pending for IMEI', MODBUS_ERROR.LENGTH));
        return;
      }

      const timer = setTimeout(() => {
        this._pending.delete(key);
        reject(
          new ModbusError('Modbus response timeout', MODBUS_ERROR.TIMEOUT, { timeoutMs }, true)
        );
      }, timeoutMs);

      this._pending.set(key, { resolve, reject, timer, sentAt });

      try {
        const ok = this.registry.write(key, codec12Packet);
        if (!ok) {
          clearTimeout(timer);
          this._pending.delete(key);
          reject(new ModbusError('Failed to write Codec 12 to socket', MODBUS_ERROR.OFFLINE));
        }
      } catch (err) {
        clearTimeout(timer);
        this._pending.delete(key);
        reject(err);
      }
    });

    let parsed;
    try {
      parsed = parseReadResponse(responsePayload, {
        expectedSlaveId: slaveId,
        expectedFunctionCode: functionCode,
        expectedRegisterCount: registerCount,
      });
    } catch (err) {
      if (err instanceof ModbusError && err.code === MODBUS_ERROR.CRC) {
        err.retryable = true;
      }
      // Wrap codec-level surprises
      if (!(err instanceof ModbusError)) {
        throw new ModbusError(err.message, MODBUS_ERROR.CODEC12, undefined, true);
      }
      throw err;
    }

    const durationMs = Date.now() - sentAt;
    let scaled = null;
    if (options.registerDef) {
      scaled = applyRegisterProfile(parsed.rawWords, options.registerDef);
    }

    const result = {
      imei: key,
      slaveId,
      functionCode,
      registerAddress,
      registerCount,
      rawWords: parsed.rawWords,
      value: scaled ? scaled.value : parsed.rawWords[0],
      unit: scaled?.unit,
      name: scaled?.name,
      durationMs,
      rawModbusHex: responsePayload.toString('hex'),
    };

    if (this.config.modbus?.debug) {
      this.logger.debug({ ...result }, 'Modbus debug decoded');
    }

    this.logger.info(
      {
        imei: key,
        value: result.value,
        unit: result.unit,
        durationMs,
      },
      'Modbus readRegister success'
    );

    return result;
  }
}

module.exports = {
  ModbusSessionService,
};
