'use strict';

const { getLogger } = require('../logger');

/**
 * ✅ Tracks active TCP connections by IMEI.
 * Foundation for live monitoring and Codec 12 Modbus writes.
 */
class ConnectionRegistry {
  constructor() {
    /** @type {Map<string, { connectionId: string, socket: import('net').Socket, connectedAt: Date, remoteAddress: string|undefined }>} */
    this._byImei = new Map();
    this.logger = getLogger().child({ component: 'ConnectionRegistry' });
  }

  /**
   * @param {string} imei
   * @param {{ connectionId: string, socket: import('net').Socket, remoteAddress?: string }} entry
   */
  add(imei, entry) {
    const key = String(imei);
    const existing = this._byImei.get(key);
    if (existing && existing.socket !== entry.socket && !existing.socket.destroyed) {
      try {
        existing.socket.destroy();
      } catch {
        // ignore
      }
    }

    this._byImei.set(key, {
      connectionId: entry.connectionId,
      socket: entry.socket,
      remoteAddress: entry.remoteAddress,
      connectedAt: new Date(),
    });
  }

  /**
   * @param {string} imei
   * @param {string} [connectionId] only remove if same connection
   */
  remove(imei, connectionId) {
    const key = String(imei);
    const existing = this._byImei.get(key);
    if (!existing) return;
    if (connectionId && existing.connectionId !== connectionId) return;
    this._byImei.delete(key);
  }

  /**
   * @param {string} imei
   */
  get(imei) {
    return this._byImei.get(String(imei)) || null;
  }

  /**
   * Write raw bytes to an online tracker socket.
   * @param {string} imei
   * @param {Buffer} buffer
   * @returns {boolean} false if offline/destroyed
   */
  write(imei, buffer) {
    const key = String(imei);
    const entry = this.get(key);

    // ✅ Diagnostic: explain early exit (behavior unchanged — still returns false)
    if (!entry) {
      this.logger.warn(
        { imei: key, reason: 'no registry entry for IMEI' },
        'registry.write early exit — socket missing'
      );
      return false;
    }
    if (!entry.socket) {
      this.logger.warn(
        { imei: key, reason: 'registry entry has no socket' },
        'registry.write early exit — socket missing'
      );
      return false;
    }
    if (entry.socket.destroyed) {
      this.logger.warn(
        { imei: key, reason: 'socket.destroyed === true' },
        'registry.write early exit — socket destroyed'
      );
      return false;
    }

    const socket = entry.socket;
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    // ✅ Diagnostic: prove what we are about to write (logic unchanged)
    this.logger.info(
      {
        imei: key,
        socketExists: true,
        socketDestroyed: socket.destroyed,
        socketWritable: socket.writable,
        bufferLength: buf.length,
        bufferHex: buf.toString('hex'),
      },
      'registry.write about to socket.write'
    );

    // Single write: capture sync return + async drain/error callback (do not call write twice)
    const ok = socket.write(buf, (err) => {
      if (err) {
        this.logger.error(
          { imei: key, err: err.message, bufferLength: buf.length },
          'socket.write callback error'
        );
      } else {
        this.logger.info(
          { imei: key, bufferLength: buf.length },
          'socket.write callback OK (bytes flushed to kernel / no write error)'
        );
      }
    });

    this.logger.info(
      { imei: key, socketWriteReturned: ok },
      `socket.write returned: ${ok}`
    );

    // Same public contract as before: true when a live socket was targeted
    return true;
  }

  /**
   * @returns {number}
   */
  size() {
    return this._byImei.size;
  }

  /**
   * @returns {string[]}
   */
  listImeis() {
    return [...this._byImei.keys()];
  }
}

module.exports = {
  ConnectionRegistry,
};
