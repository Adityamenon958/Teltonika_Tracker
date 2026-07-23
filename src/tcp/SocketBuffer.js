'use strict';

const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Per-connection byte buffer for fragmented TCP packets.
 */
class SocketBuffer {
  /**
   * @param {{ maxBytes?: number }} [options]
   */
  constructor(options = {}) {
    this._chunks = [];
    this._length = 0;
    this.maxBytes = options.maxBytes || 1024 * 1024;
  }

  get length() {
    return this._length;
  }

  /**
   * @param {Buffer} chunk
   */
  append(chunk) {
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
      return;
    }

    if (this._length + chunk.length > this.maxBytes) {
      throw new AppError(
        `Socket buffer exceeded max ${this.maxBytes} bytes`,
        ERROR_CODES.BUFFER_OVERFLOW
      );
    }

    this._chunks.push(chunk);
    this._length += chunk.length;
  }

  /**
   * @returns {Buffer}
   */
  toBuffer() {
    if (this._chunks.length === 0) {
      return Buffer.alloc(0);
    }
    if (this._chunks.length === 1) {
      return this._chunks[0];
    }
    const merged = Buffer.concat(this._chunks, this._length);
    this._chunks = [merged];
    return merged;
  }

  /**
   * Peek without consuming.
   * @param {number} size
   * @returns {Buffer|null}
   */
  peek(size) {
    if (this._length < size) {
      return null;
    }
    return this.toBuffer().subarray(0, size);
  }

  /**
   * Consume and return the first `size` bytes.
   * @param {number} size
   * @returns {Buffer}
   */
  consume(size) {
    if (size < 0) {
      throw new Error('consume size must be >= 0');
    }
    if (size === 0) {
      return Buffer.alloc(0);
    }
    if (this._length < size) {
      throw new AppError(
        `Cannot consume ${size} bytes; only ${this._length} available`,
        ERROR_CODES.PROTOCOL_ERROR
      );
    }

    const buf = this.toBuffer();
    const out = Buffer.from(buf.subarray(0, size));
    const rest = buf.subarray(size);
    this._chunks = rest.length ? [Buffer.from(rest)] : [];
    this._length = rest.length;
    return out;
  }

  clear() {
    this._chunks = [];
    this._length = 0;
  }
}

module.exports = {
  SocketBuffer,
};
