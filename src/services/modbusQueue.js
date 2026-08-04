'use strict';

/**
 * ✅ Per-IMEI FIFO queue for Modbus/Codec12 requests ONLY.
 * Never used for IMEI auth, AVL parse, or AVL ACK.
 */
class ModbusQueue {
  constructor() {
    /** @type {Map<string, { chain: Promise<unknown>, depth: number }>} */
    this._byImei = new Map();
    this.maxDepth = 50;
  }

  /**
   * @param {string} imei
   * @param {() => Promise<T>} job
   * @returns {Promise<T>}
   * @template T
   */
  enqueue(imei, job) {
    const key = String(imei);
    let entry = this._byImei.get(key);
    if (!entry) {
      entry = { chain: Promise.resolve(), depth: 0 };
      this._byImei.set(key, entry);
    }

    if (entry.depth >= this.maxDepth) {
      return Promise.reject(new Error(`Modbus queue full for IMEI ${key}`));
    }

    entry.depth += 1;

    const run = entry.chain.then(() => job(), () => job());

    entry.chain = run.then(
      () => {
        entry.depth -= 1;
        if (entry.depth <= 0) {
          this._byImei.delete(key);
        }
      },
      () => {
        entry.depth -= 1;
        if (entry.depth <= 0) {
          this._byImei.delete(key);
        }
      }
    );

    return run;
  }
}

module.exports = {
  ModbusQueue,
};
