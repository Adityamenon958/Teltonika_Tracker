'use strict';

const crypto = require('crypto');
const { SocketBuffer } = require('./SocketBuffer');
const { classifyFrame } = require('./FrameClassifier');
const { handleConnectionError, ConnectionAction } = require('../errors/errorHandler');
const { childLogger } = require('../logger');
const teltonika = require('../protocols/teltonika');
const teltonikaConsts = require('../constants/teltonika');
const { tryConsumeCodec12Frame } = require('../protocols/teltonika/codecs/codec12');
const { authenticateImei } = require('../services/authService');
const { ingestAvlRecords } = require('../services/avlIngestService');
const { scheduleLiveModbusReadAfterAuth } = require('../services/modbusLiveVerify');
const { ProtocolError } = require('../errors/ProtocolError');

const STATE = Object.freeze({
  WAIT_IMEI: 'WAIT_IMEI',
  AUTHED: 'AUTHED',
  RECEIVING_AVL: 'RECEIVING_AVL',
  CLOSED: 'CLOSED',
});

/**
 * ✅ Per-socket lifecycle + state machine.
 * AVL path unchanged in semantics; Codec 12 is additive via FrameClassifier.
 */
class ConnectionHandler {
  /**
   * @param {import('net').Socket} socket
   * @param {{
   *   config: object,
   *   registry: import('./ConnectionRegistry').ConnectionRegistry,
   *   modbusSession?: import('../services/modbusSessionService').ModbusSessionService,
   * }} deps
   */
  constructor(socket, deps) {
    this.socket = socket;
    this.config = deps.config;
    this.registry = deps.registry;
    this.modbusSession = deps.modbusSession || null;
    this.connectionId = crypto.randomUUID();
    this.state = STATE.WAIT_IMEI;
    this.imei = null;
    this.buffer = new SocketBuffer({ maxBytes: deps.config.maxBufferBytes });
    this._processing = false;
    this._destroyed = false;
    /** @type {NodeJS.Timeout | null} */
    this._liveModbusTimer = null;
    /** One-shot live Modbus verify per connection */
    this._liveModbusScheduled = false;
    /** @type {string | null} last pre-classify diagnostic frame hex (dedupe only) */
    this._lastPreClassifyDiagHex = null;
    /** @type {number | null} */
    this._lastPreClassifyDiagBufLen = null;

    this.logger = childLogger({
      connectionId: this.connectionId,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    });

    socket.setKeepAlive(true, 60_000);
    socket.setTimeout(deps.config.socketIdleTimeoutMs);

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('timeout', () => this._onTimeout());
    socket.on('error', (err) => this._onSocketError(err));
    socket.on('close', () => this._onClose());

    this.logger.info('Connection accepted');
  }

  /**
   * ✅ Drain-safe: if data arrives during await, re-enter after current loop.
   * @param {Buffer} chunk
   */
  async _onData(chunk) {
    if (this._destroyed) return;

    try {
      this.buffer.append(chunk);
      this.logger.debug({ bytes: chunk.length, buffered: this.buffer.length }, 'Data received');

      if (this._processing) {
        this._needsDrain = true;
        return;
      }

      this._processing = true;
      try {
        do {
          this._needsDrain = false;
          await this._processBuffer();
        } while (this._needsDrain && !this._destroyed);
      } finally {
        this._processing = false;
      }
    } catch (err) {
      this._handleError(err);
    }
  }

  async _processBuffer() {
    // eslint-disable-next-line no-constant-condition
    while (!this._destroyed) {
      if (this.state === STATE.WAIT_IMEI) {
        const progressed = await this._tryHandleImei();
        if (!progressed) break;
        continue;
      }

      if (this.state === STATE.AUTHED || this.state === STATE.RECEIVING_AVL) {
        const progressed = await this._tryHandlePostAuthFrame();
        if (!progressed) break;
        continue;
      }

      break;
    }
  }

  /**
   * AVL-first classification after auth.
   * @returns {Promise<boolean>}
   */
  async _tryHandlePostAuthFrame() {
    const buf = this.buffer.toBuffer();
    if (buf.length === 0) {
      return false;
    }

    // ✅ Diagnostic only: log every complete post-auth frame BEFORE classification
    this._diagLogCompleteIncomingFrame(buf);

    const kind = classifyFrame(buf);

    if (kind === 'NEED_MORE') {
      return false;
    }

    // AVL has priority when identified as AVL
    if (kind === 'AVL') {
      return this._tryHandleAvl();
    }

    if (kind === 'CODEC12') {
      return this._tryHandleCodec12();
    }

    // Ambiguous / IMEI-looking after auth — try AVL first (existing behavior safety)
    if (kind === 'UNKNOWN' || kind === 'IMEI') {
      // Attempt AVL; if incomplete, wait. Do not destroy for Modbus-looking noise yet.
      try {
        const frame = teltonika.tryConsumeAvlFrame(buf);
        if (frame) {
          return this._tryHandleAvl();
        }
      } catch (err) {
        // If preamble invalid, try codec12 before failing hard
        if (err instanceof ProtocolError) {
          try {
            const c12 = tryConsumeCodec12Frame(buf);
            if (c12) {
              return this._tryHandleCodec12();
            }
          } catch {
            // fall through
          }
        }
        throw err;
      }
      return false;
    }

    return false;
  }

  /**
   * ✅ Diagnostic only — does not parse, route, or consume.
   * Logs a complete Teltonika-sized TCP frame (preamble + dataSize + CRC layout)
   * once per unique frame hex before classifyFrame runs.
   * @param {Buffer} buf
   */
  _diagLogCompleteIncomingFrame(buf) {
    // Common Teltonika TCP envelope: 4 zero preamble + 4 dataSize + data + 4 CRC
    if (!Buffer.isBuffer(buf) || buf.length < 9) {
      return;
    }

    const preamble = buf.readUInt32BE(0);
    if (preamble !== teltonikaConsts.AVL_PREAMBLE) {
      return;
    }

    const dataSize = buf.readUInt32BE(4);
    if (dataSize <= 0 || dataSize > teltonikaConsts.MAX_DATA_FIELD_LENGTH) {
      return;
    }

    const totalFrameLength = 8 + dataSize + 4;
    if (buf.length < totalFrameLength) {
      return;
    }

    const frame = buf.subarray(0, totalFrameLength);
    const frameHex = frame.toString('hex');

    // Dedupe only while the same unconsumed bytes remain (length + hex).
    // After consume, length changes so a later identical frame still logs.
    if (
      this._lastPreClassifyDiagHex === frameHex &&
      this._lastPreClassifyDiagBufLen === buf.length
    ) {
      return;
    }
    this._lastPreClassifyDiagHex = frameHex;
    this._lastPreClassifyDiagBufLen = buf.length;

    const codecByte = frame.length >= 9 ? frame.readUInt8(8) : undefined;

    this.logger.info(
      {
        imei: this.imei,
        connectionId: this.connectionId,
        totalFrameLength,
        fullFrameHex: frameHex,
        first16BytesHex: frame.subarray(0, Math.min(16, frame.length)).toString('hex'),
        codecByteDecimal: codecByte,
        codecByteHex:
          codecByte === undefined
            ? undefined
            : `0x${codecByte.toString(16).padStart(2, '0')}`,
      },
      'Incoming complete TCP frame before classification (diagnostic)'
    );
  }

  /**
   * @returns {Promise<boolean>}
   */
  async _tryHandleImei() {
    const buf = this.buffer.toBuffer();
    const parsed = teltonika.tryParseImeiLogin(buf);
    if (!parsed) {
      return false;
    }

    this.buffer.consume(parsed.bytesConsumed);
    const { imei } = parsed;

    const result = await authenticateImei(imei, this.config);

    if (!result.accepted) {
      this.logger.warn({ imei, reason: result.reason }, 'IMEI authentication rejected');
      this._write(teltonika.buildLoginResponse(false));
      this._destroy();
      return false;
    }

    this.imei = imei;
    this.state = STATE.AUTHED;
    this.logger = this.logger.child({ imei });
    this.registry.add(imei, {
      connectionId: this.connectionId,
      socket: this.socket,
      remoteAddress: this.socket.remoteAddress,
    });

    this._write(teltonika.buildLoginResponse(true));
    this.logger.info('tracker authenticated');

    // ✅ Event-driven M1 live verify — only after auth + socket registered (once per connection)
    if (!this._liveModbusScheduled) {
      this._liveModbusScheduled = true;
      this._liveModbusTimer = scheduleLiveModbusReadAfterAuth({
        imei,
        connectionId: this.connectionId,
        modbusSession: this.modbusSession,
        logger: this.logger,
        delayMs: 4000,
      });
    }

    return true;
  }

  /**
   * Existing AVL path — semantics unchanged (ingest then ACK).
   * @returns {Promise<boolean>}
   */
  async _tryHandleAvl() {
    const buf = this.buffer.toBuffer();
    const frame = teltonika.tryConsumeAvlFrame(buf);
    if (!frame) {
      return false;
    }

    this.buffer.consume(frame.bytesConsumed);
    this.state = STATE.RECEIVING_AVL;

    const decoded = teltonika.decodeAvlDataField(frame.dataField);

    const { storedCount } = await ingestAvlRecords({
      imei: this.imei,
      codecId: decoded.codecId,
      records: decoded.records,
    });

    // ACK only after successful durable write — never queued behind Modbus
    this._write(teltonika.buildRecordCountAck(storedCount));
    this.logger.info(
      { storedCount, codecId: decoded.codecId },
      'AVL packet processed and ACK sent'
    );

    return true;
  }

  /**
   * Codec 12 inbound — never fails AVL session on Modbus errors.
   * @returns {Promise<boolean>}
   */
  async _tryHandleCodec12() {
    const buf = this.buffer.toBuffer();
    let frame;
    try {
      frame = tryConsumeCodec12Frame(buf);
    } catch (err) {
      // Bad Codec 12 framing: drop what we can / fail Modbus waiter, do not kill GPS by default
      this.logger.warn({ err }, 'Codec 12 frame error (tracker stays connected)');
      if (this.modbusSession && this.imei && typeof this.modbusSession.failPending === 'function') {
        const { ModbusError, MODBUS_ERROR } = require('../protocols/modbus/errors');
        this.modbusSession.failPending(
          this.imei,
          new ModbusError(
            err.message || 'Codec 12 parse failed',
            MODBUS_ERROR.CODEC12,
            undefined,
            true
          )
        );
      }
      // Consume nothing on CRC error — may desync. Attempt to skip one preamble frame if sized.
      // Safer for M1: destroy only if irreparable — plan says last resort.
      // If we cannot consume, leave bytes and wait — but CRC errors throw after full frame known.
      // tryConsume throws after knowing totalSize — re-parse size and skip frame to resync.
      if (buf.length >= 8) {
        const dataSize = buf.readUInt32BE(4);
        const total = 8 + dataSize + 4;
        if (dataSize > 0 && buf.length >= total && total < this.config.maxBufferBytes) {
          this.buffer.consume(total);
          return true;
        }
      }
      return false;
    }

    if (!frame) {
      return false;
    }

    this.buffer.consume(frame.bytesConsumed);

    // ✅ Diagnostic only: log every parsed Codec12 frame before type filtering
    const rawFrameHex = buf.subarray(0, frame.bytesConsumed).toString('hex');
    this.logger.info(
      {
        imei: this.imei,
        codecId: 0x0c,
        frameTypeDecimal: frame.type,
        frameTypeHex: `0x${Number(frame.type).toString(16).padStart(2, '0')}`,
        payloadLength: frame.payload.length,
        codec12FrameHex: rawFrameHex,
        payloadHex: frame.payload.toString('hex'),
      },
      'Codec12 frame parsed (diagnostic)'
    );

    // ✅ Type 0x06 = serial/Modbus reply; deliver payload to Modbus session only
    if (frame.type === teltonikaConsts.TYPE_RESPONSE && this.modbusSession && this.imei) {
      const rawCodec12Hex = this.config.modbus?.debug
        ? buf.subarray(0, frame.bytesConsumed).toString('hex')
        : undefined;
      this.modbusSession.handleInbound(this.imei, frame.payload, { rawCodec12Hex });
    } else {
      this.logger.debug(
        { type: frame.type, payloadLen: frame.payload.length },
        'Codec 12 frame ignored (not a Modbus response waiter)'
      );
    }

    return true;
  }

  _write(buffer) {
    if (this._destroyed || this.socket.destroyed) return;
    this.socket.write(buffer);
  }

  _onTimeout() {
    this.logger.warn('Socket idle timeout');
    this._destroy();
  }

  _onSocketError(err) {
    this.logger.warn({ err }, 'Socket error');
    this._destroy();
  }

  _onClose() {
    if (this.imei && this.modbusSession) {
      this.modbusSession.notifySocketClosed(this.imei);
    }
    this._cleanupRegistry();
    this.state = STATE.CLOSED;
    this.logger.info('Connection closed');
  }

  _handleError(err) {
    const { action, rejectLogin } = handleConnectionError(err, this.logger);

    if (rejectLogin || action === ConnectionAction.REJECT_LOGIN) {
      try {
        this._write(teltonika.buildLoginResponse(false));
      } catch {
        // ignore
      }
    }

    // No AVL ACK on failure — device will retry
    this._destroy();
  }

  _cleanupRegistry() {
    if (this.imei) {
      this.registry.remove(this.imei, this.connectionId);
    }
  }

  _destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._liveModbusTimer) {
      clearTimeout(this._liveModbusTimer);
      this._liveModbusTimer = null;
    }
    if (this.imei && this.modbusSession) {
      this.modbusSession.notifySocketClosed(this.imei);
    }
    this._cleanupRegistry();
    this.state = STATE.CLOSED;
    try {
      this.socket.destroy();
    } catch {
      // ignore
    }
  }
}

module.exports = {
  ConnectionHandler,
  STATE,
};
