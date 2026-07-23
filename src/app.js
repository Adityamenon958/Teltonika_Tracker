'use strict';

const { TcpServer } = require('./tcp/TcpServer');
const { ConnectionRegistry } = require('./tcp/ConnectionRegistry');
const { getLogger } = require('./logger');

/**
 * ✅ Composition root — wires modules; no business logic.
 * @param {object} config
 */
function createApp(config) {
  const logger = getLogger();
  const registry = new ConnectionRegistry();
  const tcpServer = new TcpServer({ config, registry });

  return {
    config,
    registry,
    tcpServer,
    async start() {
      await tcpServer.start();
      logger.info(
        { authMode: config.imeiAuthMode },
        'Teltonika Tracker application started'
      );
    },
    async stop() {
      await tcpServer.stop();
      logger.info('Teltonika Tracker application stopped');
    },
  };
}

module.exports = {
  createApp,
};
