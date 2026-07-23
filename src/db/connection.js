'use strict';

const mongoose = require('mongoose');
const { getLogger } = require('../logger');
const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../constants/errors');

/**
 * ✅ Connect once at boot. Listen for driver events for ops visibility.
 * @param {string} uri
 */
async function connectMongo(uri) {
  const logger = getLogger();

  if (!uri) {
    throw new AppError('MONGODB_URI is required', ERROR_CODES.CONFIG_INVALID);
  }

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    // Modern mongoose defaults are fine; keep options minimal
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 15000,
  });

  return mongoose.connection;
}

async function disconnectMongo() {
  const logger = getLogger();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected cleanly');
  }
}

function getConnectionState() {
  return mongoose.connection.readyState;
}

module.exports = {
  connectMongo,
  disconnectMongo,
  getConnectionState,
};
