'use strict';

const { ModbusError, MODBUS_ERROR } = require('./errors');

/**
 * ✅ Apply device-profile register definition to raw Modbus words.
 * Transport must never call this with hardcoded device knowledge — profiles only.
 *
 * @param {number[]} rawWords
 * @param {object} registerDef - generic profile register entry
 * @returns {{ value: number|bigint|number[], rawWords: number[], unit?: string, name?: string }}
 */
function applyRegisterProfile(rawWords, registerDef) {
  if (!registerDef || typeof registerDef !== 'object') {
    throw new ModbusError('Missing register definition', MODBUS_ERROR.LENGTH);
  }
  if (!Array.isArray(rawWords) || rawWords.length === 0) {
    throw new ModbusError('No raw words to decode', MODBUS_ERROR.LENGTH);
  }

  const count = registerDef.registerCount || rawWords.length;
  if (rawWords.length < count) {
    throw new ModbusError('Not enough raw words for register definition', MODBUS_ERROR.LENGTH, {
      got: rawWords.length,
      need: count,
    });
  }

  const words = rawWords.slice(0, count);
  const dataType = registerDef.dataType || 'uint16';
  const signed = registerDef.signed === true;
  const divideBy = Number(registerDef.divideBy) > 0 ? Number(registerDef.divideBy) : 1;

  let numeric;

  if (dataType === 'uint16' || dataType === 'int16') {
    let w = words[0] & 0xffff;
    if (signed || dataType === 'int16') {
      if (w & 0x8000) w -= 0x10000;
    }
    numeric = w;
  } else if (dataType === 'uint32' || dataType === 'int32') {
    const order = (registerDef.wordOrder || 'ABCD').toUpperCase();
    let hi = words[0];
    let lo = words[1];
    if (order === 'CDAB') {
      hi = words[1];
      lo = words[0];
    }
    let v = ((hi & 0xffff) << 16) | (lo & 0xffff);
    if (signed || dataType === 'int32') {
      // interpret as signed 32-bit
      v = v | 0;
    } else {
      v >>>= 0;
    }
    numeric = v;
  } else {
    // Fallback: return first word
    numeric = words[0];
  }

  const value = divideBy === 1 ? numeric : numeric / divideBy;

  return {
    value,
    rawWords: words,
    unit: registerDef.unit,
    name: registerDef.name,
    description: registerDef.description,
  };
}

module.exports = {
  applyRegisterProfile,
};
