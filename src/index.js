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

  // ✅ Optional Milestone 1 live verify (same process as TCP server — needs online FMB125)
  // Set MODBUS_LIVE_READ_IMEI=<15-digit IMEI> then restart; waits for tracker to authenticate.
  if (process.env.MODBUS_LIVE_READ_IMEI) {
    const liveImei = String(process.env.MODBUS_LIVE_READ_IMEI).trim();
    const delayMs = Number(process.env.MODBUS_LIVE_READ_DELAY_MS || 15000);
    logger.info({ imei: liveImei, delayMs }, 'Scheduled live Modbus Frequency read');
    setTimeout(async () => {
      try {
        const result = await app.readConfiguredRegister(liveImei, 'pm2140', 'frequency');
        logger.info(
          {
            imei: liveImei,
            value: result.value,
            unit: result.unit,
            rawWords: result.rawWords,
            durationMs: result.durationMs,
          },
          'LIVE Modbus Frequency read OK'
        );
      } catch (err) {
        logger.error({ err, imei: liveImei }, 'LIVE Modbus Frequency read FAILED');
      }
    }, delayMs);
  }

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
