'use strict';

/**
 * ✅ Safe non-secret defaults.
 * Real values come from environment / .env files.
 */
module.exports = {
  nodeEnv: 'development',
  tcpHost: '0.0.0.0',
  tcpPort: 5027,
  logLevel: 'info',
  imeiAuthMode: 'strict',
  socketIdleTimeoutMs: 5 * 60 * 1000,
  maxBufferBytes: 1024 * 1024,
};
