'use strict';

const { TcpServer } = require('./tcp/TcpServer');
const { ConnectionRegistry } = require('./tcp/ConnectionRegistry');
const { ModbusSessionService } = require('./services/modbusSessionService');
const { getLogger } = require('./logger');

/**
 * ✅ Composition root — wires modules; no business logic.
 * @param {object} config
 */
function createApp(config) {
  const logger = getLogger();
  const registry = new ConnectionRegistry();
  const modbusSession = new ModbusSessionService({ registry, config });
  const tcpServer = new TcpServer({ config, registry, modbusSession });

  return {
    config,
    registry,
    tcpServer,
    modbusSession,
    /**
     * Internal API — Milestone 1 entry point (no REST).
     * @type {ModbusSessionService['readRegister']}
     */
    readRegister: (...args) => modbusSession.readRegister(...args),
    /**
     * Profile-driven helper.
     * @type {ModbusSessionService['readConfiguredRegister']}
     */
    readConfiguredRegister: (...args) => modbusSession.readConfiguredRegister(...args),
    async start() {
      await tcpServer.start();
      logger.info(
        { authMode: config.imeiAuthMode, modbusDebug: Boolean(config.modbus?.debug) },
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
