'use strict';

const { verifyModbusCrc } = require('./crc');
const { ModbusError, MODBUS_ERROR } = require('./errors');

/**
 * ✅ Parse Modbus RTU response into raw register words. No device scaling.
 *
 * @param {Buffer} frame
 * @param {{
 *   expectedSlaveId: number,
 *   expectedFunctionCode: number,
 *   expectedRegisterCount: number,
 * }} expect
 * @returns {{ rawWords: number[], byteCount: number, exceptionCode?: number }}
 */
function parseReadResponse(frame, expect) {
  if (!Buffer.isBuffer(frame) || frame.length < 5) {
    throw new ModbusError('Modbus response too short', MODBUS_ERROR.LENGTH, {
      length: frame?.length,
    });
  }

  if (!verifyModbusCrc(frame)) {
    throw new ModbusError('Modbus CRC mismatch', MODBUS_ERROR.CRC, undefined, true);
  }

  const slaveId = frame.readUInt8(0);
  const functionCode = frame.readUInt8(1);

  if (slaveId !== expect.expectedSlaveId) {
    throw new ModbusError('Modbus slave ID mismatch', MODBUS_ERROR.SLAVE_MISMATCH, {
      expected: expect.expectedSlaveId,
      got: slaveId,
    });
  }

  // Exception: function | 0x80
  if (functionCode & 0x80) {
    const exceptionCode = frame.readUInt8(2);
    throw new ModbusError(
      `Modbus exception code ${exceptionCode}`,
      MODBUS_ERROR.EXCEPTION,
      { exceptionCode, functionCode },
      false
    );
  }

  if (functionCode !== expect.expectedFunctionCode) {
    throw new ModbusError('Modbus function code mismatch', MODBUS_ERROR.FUNCTION_MISMATCH, {
      expected: expect.expectedFunctionCode,
      got: functionCode,
    });
  }

  const byteCount = frame.readUInt8(2);
  const expectedBytes = expect.expectedRegisterCount * 2;
  if (byteCount !== expectedBytes) {
    throw new ModbusError('Modbus byte count mismatch', MODBUS_ERROR.LENGTH, {
      byteCount,
      expectedBytes,
    });
  }

  if (frame.length !== 3 + byteCount + 2) {
    throw new ModbusError('Modbus frame length mismatch', MODBUS_ERROR.LENGTH, {
      length: frame.length,
      expected: 3 + byteCount + 2,
    });
  }

  const rawWords = [];
  for (let i = 0; i < expect.expectedRegisterCount; i += 1) {
    rawWords.push(frame.readUInt16BE(3 + i * 2));
  }

  return { rawWords, byteCount };
}

module.exports = {
  parseReadResponse,
};
