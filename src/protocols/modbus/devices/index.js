'use strict';

const pm2140 = require('./pm2140');

const profiles = Object.freeze({
  pm2140,
});

/**
 * @param {string} profileId
 */
function getDeviceProfile(profileId) {
  const profile = profiles[profileId];
  if (!profile) {
    throw new Error(`Unknown Modbus device profile: ${profileId}`);
  }
  return profile;
}

/**
 * @param {string} profileId
 * @param {string} registerKey
 */
function getRegisterDefinition(profileId, registerKey) {
  const profile = getDeviceProfile(profileId);
  const def = profile.registers[registerKey];
  if (!def) {
    throw new Error(`Unknown register "${registerKey}" on profile "${profileId}"`);
  }
  return def;
}

module.exports = {
  profiles,
  getDeviceProfile,
  getRegisterDefinition,
};
