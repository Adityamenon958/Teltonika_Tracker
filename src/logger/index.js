'use strict';

const pino = require('pino');

/**
 * ✅ Structured logger (pino).
 * Pretty-print in development; raw JSON in production.
 */
function createLogger(options = {}) {
  const level = options.level || 'info';
  const isDevelopment = options.isDevelopment === true;

  /** @type {import('pino').LoggerOptions} */
  const opts = {
    level,
    base: { service: 'teltonika-tracker' },
    redact: {
      paths: ['mongodbUri', 'config.mongodbUri', '*.password', 'MONGODB_URI'],
      remove: true,
    },
  };

  if (isDevelopment) {
    opts.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname,service',
      },
    };
  }

  return pino(opts);
}

/** @type {import('pino').Logger | null} */
let rootLogger = null;

function initLogger(config) {
  rootLogger = createLogger({
    level: config.logLevel,
    isDevelopment: config.isDevelopment,
  });
  return rootLogger;
}

function getLogger() {
  if (!rootLogger) {
    rootLogger = createLogger({ level: 'info', isDevelopment: false });
  }
  return rootLogger;
}

/**
 * ✅ Child logger bound to a TCP connection context.
 */
function childLogger(bindings) {
  return getLogger().child(bindings);
}

module.exports = {
  initLogger,
  getLogger,
  childLogger,
  createLogger,
};
