'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const defaults = require('./defaults');
const { validateEnv } = require('./schema');

/**
 * ✅ Load the right .env file for the current NODE_ENV, then build a frozen config.
 * Order: process.env already set > .env.<NODE_ENV> > .env > defaults
 */
function loadEnvFiles() {
  const nodeEnv = process.env.NODE_ENV || defaults.nodeEnv;
  const root = path.resolve(__dirname, '../..');

  const candidates = [
    path.join(root, `.env.${nodeEnv}`),
    path.join(root, '.env'),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file });
    }
  }
}

function buildConfig() {
  loadEnvFiles();
  validateEnv(process.env);

  const nodeEnv = process.env.NODE_ENV || defaults.nodeEnv;

  const config = Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    tcp: Object.freeze({
      host: process.env.TCP_HOST || defaults.tcpHost,
      port: Number(process.env.TCP_PORT || defaults.tcpPort),
    }),
    mongodbUri: process.env.MONGODB_URI,
    logLevel: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
    imeiAuthMode: (process.env.IMEI_AUTH_MODE || defaults.imeiAuthMode).toLowerCase(),
    socketIdleTimeoutMs: Number(process.env.SOCKET_IDLE_TIMEOUT_MS || defaults.socketIdleTimeoutMs),
    maxBufferBytes: Number(process.env.MAX_BUFFER_BYTES || defaults.maxBufferBytes),
  });

  return config;
}

/** @type {ReturnType<typeof buildConfig> | null} */
let cached = null;

function getConfig() {
  if (!cached) {
    cached = buildConfig();
  }
  return cached;
}

/** @internal test helper */
function resetConfigCache() {
  cached = null;
}

module.exports = {
  getConfig,
  resetConfigCache,
};
