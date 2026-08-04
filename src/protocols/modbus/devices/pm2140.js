'use strict';

/**
 * ✅ Masibus PM2140 register profile (configuration only — not transport logic).
 *
 * Milestone 1 sample: Frequency (F) for live verification.
 * Replace/extend entries without changing Modbus transport code.
 */

const pm2140 = Object.freeze({
  id: 'pm2140',
  name: 'Masibus PM2140',
  defaultSlaveId: 2,
  registers: Object.freeze({
    frequency: Object.freeze({
      name: 'Frequency (F)',
      displayAddress: 40001,
      protocolAddress: 1,
      functionCode: 4,
      registerCount: 1,
      dataType: 'uint16',
      signed: false,
      byteOrder: 'BE',
      wordOrder: 'ABCD',
      divideBy: 100,
      unit: 'Hz',
      description: 'Line frequency test register for Milestone 1',
    }),
  }),
});

module.exports = pm2140;
