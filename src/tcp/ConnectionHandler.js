'use strict';

const crypto = require('crypto');
const { SocketBuffer } = require('./SocketBuffer');
const { handleConnectionError, ConnectionAction } = require('../errors/errorHandler');
const { childLogger } = require('../logger');
const teltonika = require('../protocols/teltonika');
const { authenticateImei } = require('../services/authService');
const { ingestAvlRecords } = require('../services/avlIngestService');

const STATE = Object.freeze({
  WAIT_IMEI: 'WAIT_IMEI',
  AUTHED: 'AUTHED',
  RECEIVING_AVL: 'RECEIVING_AVL',
  CLOSED: 'CLOSED',
});

/**
 * ✅ Per-socket lifecycle + state machine.
 * Knows TCP + orchestration; does not know Mongo schemas.
 */
class ConnectionHandler {
  /**
   * @param {import('net').Socket} socket
   * @param {{
   *   config: object,
   *   registry: import('./ConnectionRegistry').ConnectionRegistry,
   * }} deps
   */
  constructor(socket, deps) {
    this.socket = socket;
    this.config = deps.config;
    this.registry = deps.registry;
    this.connectionId = crypto.randomUUID();
    this.state = STATE.WAIT_IMEI;
    this.imei = null;
    this.buffer = new SocketBuffer({ maxBytes: deps.config.maxBufferBytes });
    this._processing = false;
    this._destroyed = false;

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
   * @param {Buffer} chunk
   */
  async _onData(chunk) {
    if (this._destroyed) return;

    try {
      this.buffer.append(chunk);
      this.logger.debug({ bytes: chunk.length, buffered: this.buffer.length }, 'Data received');

      if (this._processing) return;
      this._processing = true;

      try {
        await this._processBuffer();
      } finally {
        this._processing = false;
      }
    } catch (err) {
      this._handleError(err);
    }
  }

  async _processBuffer() {
    // Loop while complete packets are available
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.state === STATE.WAIT_IMEI) {
        const progressed = await this._tryHandleImei();
        if (!progressed) break;
        continue;
      }

      if (this.state === STATE.AUTHED || this.state === STATE.RECEIVING_AVL) {
        const progressed = await this._tryHandleAvl();
        if (!progressed) break;
        continue;
      }

      break;
    }
  }

  /**
   * @returns {Promise<boolean>} true if a packet was consumed
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
    this.logger.info('IMEI authenticated');
    return true;
  }

  /**
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

    // ACK only after successful durable write
    this._write(teltonika.buildRecordCountAck(storedCount));
    this.logger.info(
      { storedCount, codecId: decoded.codecId },
      'AVL packet processed and ACK sent'
    );

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

    // No ACK on failure — device will retry
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
