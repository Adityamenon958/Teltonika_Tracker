'use strict';

/**
 * ✅ Tracks active TCP connections by IMEI.
 * Foundation for future live online/offline monitoring.
 */
class ConnectionRegistry {
  constructor() {
    /** @type {Map<string, { connectionId: string, socket: import('net').Socket, connectedAt: Date, remoteAddress: string|undefined }>} */
    this._byImei = new Map();
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
