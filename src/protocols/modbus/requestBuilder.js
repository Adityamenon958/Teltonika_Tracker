'use strict';

const { appendModbusCrc } = require('./crc');
const { ModbusError, MODBUS_ERROR } = require('./errors');

/**
 * ✅ Build Modbus RTU request frame (includes Modbus CRC). Device-agnostic.
 *
 * @param {{
 *   slaveId: number,
 *   functionCode: number,
 *   registerAddress: number,
 *   registerCount: number,
 * }} params
 * @returns {Buffer}
 */
function buildReadRequest(params) {
  const slaveId = Number(params.slaveId);
  const functionCode = Number(params.functionCode);
  const registerAddress = Number(params.registerAddress);
  const registerCount = Number(params.registerCount);

  if (!Number.isInteger(slaveId) || slaveId < 1 || slaveId > 247) {
    throw new ModbusError('Invalid Modbus slaveId', MODBUS_ERROR.LENGTH, { slaveId });
  }
  if (![3, 4].includes(functionCode)) {
    throw new ModbusError(
      `Unsupported functionCode for read builder: ${functionCode}`,
      MODBUS_ERROR.FUNCTION_MISMATCH,
      { functionCode }
    );
  }
  if (!Number.isInteger(registerAddress) || registerAddress < 0 || registerAddress > 0xffff) {
    throw new ModbusError('Invalid registerAddress', MODBUS_ERROR.LENGTH, { registerAddress });
  }
  if (!Number.isInteger(registerCount) || registerCount < 1 || registerCount > 125) {
    throw new ModbusError('Invalid registerCount', MODBUS_ERROR.LENGTH, { registerCount });
  }

  const pdu = Buffer.alloc(6);
  pdu.writeUInt8(slaveId, 0);
  pdu.writeUInt8(functionCode, 1);
  pdu.writeUInt16BE(registerAddress, 2);
  pdu.writeUInt16BE(registerCount, 4);

  return appendModbusCrc(pdu);
}

module.exports = {
  buildReadRequest,
};
