'use strict';

const net = require('net');
const { ConnectionHandler } = require('./ConnectionHandler');
const { getLogger } = require('../logger');

/**
 * ✅ TCP listen / accept only. No codec or Mongo logic.
 */
class TcpServer {
  /**
   * @param {{
   *   config: object,
   *   registry: import('./ConnectionRegistry').ConnectionRegistry,
   *   modbusSession?: import('../services/modbusSessionService').ModbusSessionService,
   * }} deps
   */
  constructor(deps) {
    this.config = deps.config;
    this.registry = deps.registry;
    this.modbusSession = deps.modbusSession || null;
    this.server = null;
    this.logger = getLogger();
  }

  /**
   * @returns {Promise<void>}
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        // Each connection is isolated; errors handled inside ConnectionHandler
        // eslint-disable-next-line no-new
        new ConnectionHandler(socket, {
          config: this.config,
          registry: this.registry,
          modbusSession: this.modbusSession,
        });
      });

      this.server.on('error', (err) => {
        this.logger.error({ err }, 'TCP server error');
        reject(err);
      });

      this.server.listen(this.config.tcp.port, this.config.tcp.host, () => {
        this.logger.info(
          {
            host: this.config.tcp.host,
            port: this.config.tcp.port,
          },
          'TCP server listening'
        );
        resolve();
      });
    });
  }

  /**
   * Stop accepting new connections.
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.logger.info('TCP server stopped');
        resolve();
      });
    });
  }
}

module.exports = {
  TcpServer,
};
