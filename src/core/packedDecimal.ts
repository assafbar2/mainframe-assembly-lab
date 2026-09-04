/**
 * IBM Mainframe Packed Decimal (BCD) Engine
 * Implements PACK, UNPK, AP, SP, CP arithmetic without floating-point errors.
 */

import type { ConditionCode } from './types';

/**
 * Checks if a nibble is a valid positive sign (0xC or 0xF)
 */
export function isPositiveSign(nibble: number): boolean {
  return nibble === 0x0c || nibble === 0x0f || nibble === 0x0a || nibble === 0x0e;
}

/**
 * Checks if a nibble is a valid negative sign (0xD or 0xB)
 */
export function isNegativeSign(nibble: number): boolean {
  return nibble === 0x0d || nibble === 0x0b;
}

/**
 * Decodes a packed decimal byte slice into a JavaScript BigInt
 */
export function decodePacked(bytes: Uint8Array, offset: number, len: number): { value: bigint; isNegative: boolean; hex: string } {
  let hex = '';
  let digitsStr = '';
  let isNegative = false;

  for (let i = 0; i < len; i++) {
    const byte = bytes[offset + i] ?? 0;
    const high = (byte >> 4) & 0x0f;
    const low = byte & 0x0f;

    hex += byte.toString(16).padStart(2, '0').toUpperCase() + ' ';

    if (i === len - 1) {
      // Last byte: high is digit, low is sign
      digitsStr += high.toString(10);
      if (isNegativeSign(low)) {
        isNegative = true;
      }
    } else {
      digitsStr += high.toString(10);
      digitsStr += low.toString(10);
    }
  }

  const rawVal = BigInt(digitsStr || '0');
  const value = isNegative ? -rawVal : rawVal;

  return { value, isNegative, hex: hex.trim() };
}

/**
 * Encodes a BigInt into a packed decimal byte array of specified length.
 * Returns true if fits, false if overflow.
 */
export function encodePacked(val: bigint, dest: Uint8Array, offset: number, len: number): boolean {
  const isNegative = val < 0n;
  const absVal = isNegative ? -val : val;
  const signNibble = isNegative ? 0x0d : 0x0c;

  let str = absVal.toString(10);
  const maxDigits = len * 2 - 1;

  let overflow = false;
  if (str.length > maxDigits) {
    overflow = true;
    str = str.slice(-maxDigits); // truncate high digits on overflow
  }

  // Pad left with zeros to match maxDigits
  str = str.padStart(maxDigits, '0');

  // Pack digits
  let strIdx = 0;
  for (let i = 0; i < len; i++) {
    const high = parseInt(str[strIdx++], 10) & 0x0f;
    let low: number;
    if (i === len - 1) {
      low = signNibble;
    } else {
      low = parseInt(str[strIdx++], 10) & 0x0f;
    }
    dest[offset + i] = (high << 4) | low;
  }

  return !overflow;
}

/**
 * Executes the PACK instruction
 * PACK D1(L1, B1), D2(L2, B2)
 * Converts Zoned Decimal (operand 2) to Packed Decimal (operand 1).
 */
export function execPack(
  mem: Uint8Array,
  destOff: number,
  destLen: number,
  srcOff: number,
  srcLen: number
): void {
  // Collect digits from right to left
  const digits: number[] = [];
  let signNibble = 0x0c;

  // Last byte of zoned holds the sign in its high nibble and last digit in low nibble
  const lastByte = mem[srcOff + srcLen - 1] ?? 0xf0;
  const lastZone = (lastByte >> 4) & 0x0f;
  const lastDigit = lastByte & 0x0f;

  if (isNegativeSign(lastZone)) {
    signNibble = 0x0d;
  } else {
    signNibble = 0x0c;
  }
  digits.push(lastDigit);

  // Preceding bytes: each low nibble is a digit
  for (let i = srcLen - 2; i >= 0; i--) {
    const b = mem[srcOff + i] ?? 0xf0;
    digits.push(b & 0x0f);
  }

  // Digits array currently has lowest significant digit at index 0
  // Pack into destination from right to left
  let digitIdx = 0;
  for (let i = destLen - 1; i >= 0; i--) {
    let low: number;
    let high: number;

    if (i === destLen - 1) {
      low = signNibble;
      high = digitIdx < digits.length ? digits[digitIdx++] : 0;
    } else {
      low = digitIdx < digits.length ? digits[digitIdx++] : 0;
      high = digitIdx < digits.length ? digits[digitIdx++] : 0;
    }

    mem[destOff + i] = (high << 4) | low;
  }
}

/**
 * Executes the UNPK instruction
 * UNPK D1(L1, B1), D2(L2, B2)
 * Converts Packed Decimal (operand 2) to Zoned Decimal (operand 1).
 */
export function execUnpack(
  mem: Uint8Array,
  destOff: number,
  destLen: number,
  srcOff: number,
  srcLen: number
): void {
  // Collect digits from operand 2
  const digits: number[] = [];
  let signNibble = 0x0c;

  for (let i = 0; i < srcLen; i++) {
    const b = mem[srcOff + i] ?? 0;
    const high = (b >> 4) & 0x0f;
    const low = b & 0x0f;

    if (i === srcLen - 1) {
      digits.push(high);
      signNibble = low;
    } else {
      digits.push(high);
      digits.push(low);
    }
  }

  // Destination zoned format: right-to-left
  // Last byte gets sign in zone (high nibble) and digit in low nibble
  let digitIdx = digits.length - 1;

  for (let i = destLen - 1; i >= 0; i--) {
    const d = digitIdx >= 0 ? digits[digitIdx--] : 0;
    if (i === destLen - 1) {
      // Last byte: zone is sign (0xC or 0xD or standard 0xF if positive)
      const zone = isNegativeSign(signNibble) ? 0xd0 : 0xc0;
      mem[destOff + i] = zone | (d & 0x0f);
    } else {
      // Normal digit: EBCDIC zone 0xF
      mem[destOff + i] = 0xf0 | (d & 0x0f);
    }
  }
}

/**
 * Converts zoned decimal bytes (EBCDIC) into a standard formatted string and number
 */
export function zonedToNumber(mem: Uint8Array, offset: number, len: number): { value: number; str: string; isNegative: boolean } {
  let digitsStr = '';
  let isNegative = false;

  for (let i = 0; i < len; i++) {
    const b = mem[offset + i] ?? 0xf0;
    const digit = b & 0x0f;
    digitsStr += digit.toString(10);
    if (i === len - 1) {
      const zone = (b >> 4) & 0x0f;
      if (isNegativeSign(zone)) {
        isNegative = true;
      }
    }
  }

  const rawNum = parseInt(digitsStr || '0', 10);
  const value = isNegative ? -rawNum : rawNum;
  return { value, str: (isNegative ? '-' : '') + digitsStr, isNegative };
}

/**
 * Executes AP (Add Packed)
 * AP D1(L1, B1), D2(L2, B2)
 * Adds op2 to op1, stores in op1, and sets Condition Code.
 */
export function execAddPacked(
  mem: Uint8Array,
  destOff: number,
  destLen: number,
  srcOff: number,
  srcLen: number
): { cc: ConditionCode } {
  const op1 = decodePacked(mem, destOff, destLen);
  const op2 = decodePacked(mem, srcOff, srcLen);

  const result = op1.value + op2.value;
  const fits = encodePacked(result, mem, destOff, destLen);

  if (!fits) {
    return { cc: 3 }; // Decimal overflow
  }

  if (result === 0n) return { cc: 0 };
  if (result < 0n) return { cc: 1 };
  return { cc: 2 };
}

/**
 * Executes SP (Subtract Packed)
 * SP D1(L1, B1), D2(L2, B2)
 * Subtracts op2 from op1, stores in op1, and sets Condition Code.
 */
export function execSubPacked(
  mem: Uint8Array,
  destOff: number,
  destLen: number,
  srcOff: number,
  srcLen: number
): { cc: ConditionCode } {
  const op1 = decodePacked(mem, destOff, destLen);
  const op2 = decodePacked(mem, srcOff, srcLen);

  const result = op1.value - op2.value;
  const fits = encodePacked(result, mem, destOff, destLen);

  if (!fits) {
    return { cc: 3 }; // Decimal overflow
  }

  if (result === 0n) return { cc: 0 };
  if (result < 0n) return { cc: 1 };
  return { cc: 2 };
}

/**
 * Executes CP (Compare Packed)
 * CP D1(L1, B1), D2(L2, B2)
 * Compares op1 with op2 without altering memory, sets Condition Code.
 */
export function execComparePacked(
  mem: Uint8Array,
  destOff: number,
  destLen: number,
  srcOff: number,
  srcLen: number
): { cc: ConditionCode } {
  const op1 = decodePacked(mem, destOff, destLen);
  const op2 = decodePacked(mem, srcOff, srcLen);

  if (op1.value === op2.value) return { cc: 0 };
  if (op1.value < op2.value) return { cc: 1 };
  return { cc: 2 };
}
