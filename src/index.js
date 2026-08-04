'use strict';

/**
 * ✅ Process entry: load config → logger → Mongo → TCP → graceful shutdown.
 */

const { getConfig } = require('./config');
const { initLogger, getLogger } = require('./logger');
const { connectMongo, disconnectMongo } = require('./db/connection');
const { createApp } = require('./app');

let app = null;
let shuttingDown = false;

async function main() {
  const config = getConfig();
  initLogger(config);
  const logger = getLogger();

  logger.info({ nodeEnv: config.nodeEnv }, 'Booting Teltonika Tracker');

  await connectMongo(config.mongodbUri);

  app = createApp(config);
  await app.start();

  // Live Modbus verify is event-driven: triggered after IMEI auth in ConnectionHandler
  // when process.env.MODBUS_LIVE_READ_IMEI matches the authenticated tracker.

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutdown signal received');

    try {
      if (app) {
        await app.stop();
      }
      await disconnectMongo();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.fatal({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

main().catch((err) => {
  // Logger may not be ready
  // eslint-disable-next-line no-console
  console.error('Fatal boot error:', err);
  process.exit(1);
});
