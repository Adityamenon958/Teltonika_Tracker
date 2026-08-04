'use strict';

/**
 * ✅ Milestone 1 helper — call internal readConfiguredRegister against a live tracker.
 *
 * Prerequisites:
 * - Server already running (npm run dev) with FMB125 online and authenticated
 * - This script cannot share the in-process registry of another Node process.
 *
 * For true live verify, use a REPL attached to the running app, OR run the server
 * with an exported control hook. This script documents the API and can be adapted
 * when embedding in the same process.
 *
 * Usage (same process / future): app.readConfiguredRegister(imei, 'pm2140', 'frequency')
 */

const { getRegisterDefinition } = require('../src/protocols/modbus/devices');

const def = getRegisterDefinition('pm2140', 'frequency');
// eslint-disable-next-line no-console
console.log('PM2140 Frequency test register definition:');
// eslint-disable-next-line no-console
console.log(JSON.stringify(def, null, 2));
// eslint-disable-next-line no-console
console.log(`
Live call (from app instance in same process):

  const result = await app.readConfiguredRegister('<IMEI>', 'pm2140', 'frequency');
  // expect result.value ≈ 50.00, result.unit === 'Hz'

Ensure FMB125 RS485 = TCP Binary, baud 9600, parity None, PM2140 slave 2.
`);
