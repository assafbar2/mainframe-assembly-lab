/**
 * High Level Assembler (HLASM) Two-Pass Assembler
 * Parses IBM Mainframe Assembly source into bytecode with symbol resolution,
 * base-displacement calculation, and detailed listing output.
 */

import { asciiToEbcdic } from './ebcdic';
import { encodePacked } from './packedDecimal';
import type {
  AssemblyListingLine,
  AssemblyResult,
  InstructionFormat,
  ParsedInstruction,
  SymbolEntry,
  UsingEntry,
} from './types';

interface OpcodeSpec {
  opcode: number;
  format: InstructionFormat;
  length: number;
  mask?: number; // For extended mnemonics
}

const OPCODES: Record<string, OpcodeSpec> = {
  // RR format (2 bytes)
  LR: { opcode: 0x18, format: 'RR', length: 2 },
  AR: { opcode: 0x1a, format: 'RR', length: 2 },
  SR: { opcode: 0x1b, format: 'RR', length: 2 },
  MR: { opcode: 0x1c, format: 'RR', length: 2 },
  DR: { opcode: 0x1d, format: 'RR', length: 2 },
  CR: { opcode: 0x19, format: 'RR', length: 2 },
  NR: { opcode: 0x14, format: 'RR', length: 2 },
  OR: { opcode: 0x16, format: 'RR', length: 2 },
  XR: { opcode: 0x17, format: 'RR', length: 2 },
  BCR: { opcode: 0x07, format: 'RR', length: 2 },
  BALR: { opcode: 0x05, format: 'RR', length: 2 },
  BASR: { opcode: 0x0d, format: 'RR', length: 2 },

  // Extended RR Branch Mnemonics
  BR: { opcode: 0x07, format: 'RR', length: 2, mask: 15 },
  BER: { opcode: 0x07, format: 'RR', length: 2, mask: 8 },
  BNER: { opcode: 0x07, format: 'RR', length: 2, mask: 7 },
  BLR: { opcode: 0x07, format: 'RR', length: 2, mask: 4 },
  BHR: { opcode: 0x07, format: 'RR', length: 2, mask: 2 },
  BNLR: { opcode: 0x07, format: 'RR', length: 2, mask: 11 },
  BNHR: { opcode: 0x07, format: 'RR', length: 2, mask: 13 },
  BZR: { opcode: 0x07, format: 'RR', length: 2, mask: 8 },
  BNZR: { opcode: 0x07, format: 'RR', length: 2, mask: 7 },
  NOPR: { opcode: 0x07, format: 'RR', length: 2, mask: 0 },

  // RX format (4 bytes)
  L: { opcode: 0x58, format: 'RX', length: 4 },
  ST: { opcode: 0x50, format: 'RX', length: 4 },
  A: { opcode: 0x5a, format: 'RX', length: 4 },
  S: { opcode: 0x5b, format: 'RX', length: 4 },
  C: { opcode: 0x59, format: 'RX', length: 4 },
  LA: { opcode: 0x41, format: 'RX', length: 4 },
  LH: { opcode: 0x48, format: 'RX', length: 4 },
  STH: { opcode: 0x40, format: 'RX', length: 4 },
  AH: { opcode: 0x4a, format: 'RX', length: 4 },
  SH: { opcode: 0x4b, format: 'RX', length: 4 },
  BC: { opcode: 0x47, format: 'RX', length: 4 },
  BAL: { opcode: 0x45, format: 'RX', length: 4 },
  BCT: { opcode: 0x46, format: 'RX', length: 4 },

  // Extended RX Branch Mnemonics
  B: { opcode: 0x47, format: 'RX', length: 4, mask: 15 },
  BE: { opcode: 0x47, format: 'RX', length: 4, mask: 8 },
  BNE: { opcode: 0x47, format: 'RX', length: 4, mask: 7 },
  BL: { opcode: 0x47, format: 'RX', length: 4, mask: 4 },
  BH: { opcode: 0x47, format: 'RX', length: 4, mask: 2 },
  BNL: { opcode: 0x47, format: 'RX', length: 4, mask: 11 },
  BNH: { opcode: 0x47, format: 'RX', length: 4, mask: 13 },
  BZ: { opcode: 0x47, format: 'RX', length: 4, mask: 8 },
  BNZ: { opcode: 0x47, format: 'RX', length: 4, mask: 7 },
  NOP: { opcode: 0x47, format: 'RX', length: 4, mask: 0 },

  // SI format (4 bytes)
  MVI: { opcode: 0x92, format: 'SI', length: 4 },
  CLI: { opcode: 0x95, format: 'SI', length: 4 },
  NI: { opcode: 0x94, format: 'SI', length: 4 },
  OI: { opcode: 0x96, format: 'SI', length: 4 },
  XI: { opcode: 0x97, format: 'SI', length: 4 },

  // SS format (6 bytes)
  MVC: { opcode: 0xd2, format: 'SS', length: 6 },
  CLC: { opcode: 0xd5, format: 'SS', length: 6 },
  PACK: { opcode: 0xf2, format: 'SS', length: 6 },
  UNPK: { opcode: 0xf3, format: 'SS', length: 6 },
  AP: { opcode: 0xfa, format: 'SS', length: 6 },
  SP: { opcode: 0xfb, format: 'SS', length: 6 },
  CP: { opcode: 0xf9, format: 'SS', length: 6 },
};

export class Assembler {
  private symbols: Record<string, SymbolEntry> = {};
  private usingTable: UsingEntry[] = [];
  private errors: { lineNum: number; message: string }[] = [];
  private listing: AssemblyListingLine[] = [];
  private instructions: ParsedInstruction[] = [];
  private locationCounter = 0;
  private entryPoint = 0;

  /**
   * Assembles HLASM source code string into bytecode and symbol tables
   */
  public assemble(source: string): AssemblyResult {
    this.symbols = {};
    this.usingTable = [];
    this.errors = [];
    this.listing = [];
    this.instructions = [];
    this.locationCounter = 0;
    this.entryPoint = 0;

    const rawLines = source.split(/\r?\n/);

    // Pre-populate register equate symbols R0-R15
    for (let r = 0; r <= 15; r++) {
      this.symbols[`R${r}`] = { name: `R${r}`, address: r, length: 0, type: 'EQU', value: r };
    }

    // Pass 1: Collect symbols and calculate location counter
    this.pass1(rawLines);

    // Reset location counter and using table for Pass 2
    this.locationCounter = 0;
    this.usingTable = [];

    // Pass 2: Generate machine code
    this.pass2(rawLines);

    return {
      success: this.errors.length === 0,
      listing: this.listing,
      instructions: this.instructions,
      symbols: this.symbols,
      errors: this.errors,
      entryPoint: this.entryPoint,
      codeLength: this.locationCounter,
    };
  }

  // --- PASS 1: Symbol Definition & Length Calculation ---
  private pass1(lines: string[]) {
    let loc = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const parsed = this.tokenizeLine(rawLine);

      if (!parsed || parsed.isComment) {
        continue;
      }

      const { label, mnemonic, operands } = parsed;

      if (mnemonic === 'CSECT') {
        if (label) {
          this.symbols[label] = { name: label, address: loc, length: 1, type: 'LABEL' };
        }
        continue;
      }

      if (mnemonic === 'EQU') {
        if (!label) {
          this.errors.push({ lineNum, message: 'EQU requires a label' });
        } else {
          const val = this.parseEquValue(operands);
          this.symbols[label] = { name: label, address: val, length: 0, type: 'EQU', value: val };
        }
        continue;
      }

      if (mnemonic === 'USING' || mnemonic === 'DROP' || mnemonic === 'END') {
        continue;
      }

      if (mnemonic === 'DC' || mnemonic === 'DS') {
        const len = this.calculateDataLength(operands, mnemonic === 'DC');
        if (label) {
          this.symbols[label] = { name: label, address: loc, length: len, type: mnemonic };
        }
        loc += len;
        continue;
      }

      // Check instruction opcode
      const spec = OPCODES[mnemonic];
      if (spec) {
        if (label) {
          this.symbols[label] = { name: label, address: loc, length: spec.length, type: 'LABEL' };
        }
        loc += spec.length;
      } else {
        this.errors.push({ lineNum, message: `Unknown instruction mnemonic '${mnemonic}'` });
      }
    }
  }

  // --- PASS 2: Code Generation ---
  private pass2(lines: string[]) {
    let loc = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const parsed = this.tokenizeLine(rawLine);

      if (!parsed) {
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine });
        continue;
      }

      if (parsed.isComment) {
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine });
        continue;
      }

      const { label, mnemonic, operands } = parsed;

      // Pseudo-instructions
      if (mnemonic === 'CSECT') {
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine });
        continue;
      }

      if (mnemonic === 'EQU') {
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine });
        continue;
      }

      if (mnemonic === 'USING') {
        this.handleUsing(operands, loc, lineNum);
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine });
        continue;
      }

      if (mnemonic === 'DROP') {
        this.handleDrop(operands);
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine });
        continue;
      }

      if (mnemonic === 'END') {
        if (operands) {
          const sym = this.symbols[operands.trim()];
          if (sym) {
            this.entryPoint = sym.address;
          }
        }
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine });
        break;
      }

      if (mnemonic === 'DS') {
        const len = this.calculateDataLength(operands, false);
        const bytes = new Uint8Array(len); // Zeroed memory allocation
        const hex = this.bytesToHex(bytes);

        this.instructions.push({
          lineNum,
          sourceText: rawLine,
          address: loc,
          length: len,
          bytes,
          mnemonic,
          operands,
          label,
        });

        this.listing.push({ lineNum, address: loc, objectCode: hex, sourceText: rawLine });
        loc += len;
        continue;
      }

      if (mnemonic === 'DC') {
        const bytes = this.assembleDC(operands, lineNum);
        const hex = this.bytesToHex(bytes);

        this.instructions.push({
          lineNum,
          sourceText: rawLine,
          address: loc,
          length: bytes.length,
          bytes,
          mnemonic,
          operands,
          label,
        });

        this.listing.push({ lineNum, address: loc, objectCode: hex, sourceText: rawLine });
        loc += bytes.length;
        continue;
      }

      const spec = OPCODES[mnemonic];
      if (!spec) {
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine, error: `Unknown opcode: ${mnemonic}` });
        continue;
      }

      try {
        const bytes = this.assembleInstruction(spec, mnemonic, operands, loc, lineNum);
        const hex = this.bytesToHex(bytes);

        this.instructions.push({
          lineNum,
          sourceText: rawLine,
          address: loc,
          length: spec.length,
          bytes,
          mnemonic,
          operands,
          label,
        });

        this.listing.push({ lineNum, address: loc, objectCode: hex, sourceText: rawLine });
        loc += spec.length;
      } catch (err: any) {
        this.errors.push({ lineNum, message: err.message || 'Error generating machine code' });
        this.listing.push({ lineNum, address: loc, objectCode: '', sourceText: rawLine, error: err.message });
      }
    }

    this.locationCounter = loc;
  }

  // --- INSTRUCTION ENCODERS ---

  private assembleInstruction(
    spec: OpcodeSpec,
    mnemonic: string,
    operandsStr: string,
    currentLoc: number,
    lineNum: number
  ): Uint8Array {
    const bytes = new Uint8Array(spec.length);
    bytes[0] = spec.opcode;

    const opList = this.splitOperands(operandsStr);

    switch (spec.format) {
      case 'RR': {
        let r1 = 0;
        let r2 = 0;

        if (spec.mask !== undefined) {
          // Extended mnemonic like BR R14 or BZR R2
          r1 = spec.mask;
          r2 = this.resolveRegister(opList[0] || '0', lineNum);
        } else {
          r1 = this.resolveRegister(opList[0] || '0', lineNum);
          r2 = this.resolveRegister(opList[1] || '0', lineNum);
        }

        bytes[1] = ((r1 & 0x0f) << 4) | (r2 & 0x0f);
        break;
      }

      case 'RX': {
        let r1 = 0;
        let storageOp = '';

        if (spec.mask !== undefined) {
          // Extended mnemonic like B TARGET or BE TARGET
          r1 = spec.mask;
          storageOp = opList[0] || '';
        } else {
          r1 = this.resolveRegister(opList[0] || '0', lineNum);
          storageOp = opList[1] || '';
        }

        const { d, x, b } = this.resolveAddressRX(storageOp, currentLoc, lineNum);
        bytes[1] = ((r1 & 0x0f) << 4) | (x & 0x0f);
        bytes[2] = ((b & 0x0f) << 4) | ((d >> 8) & 0x0f);
        bytes[3] = d & 0xff;
        break;
      }

      case 'SI': {
        // MVI D(B), I
        const storageOp = opList[0] || '';
        const immStr = opList[1] || '0';

        const { d, b } = this.resolveAddressSI(storageOp, currentLoc, lineNum);
        const immByte = this.parseImmediateByte(immStr, lineNum);

        bytes[1] = immByte & 0xff;
        bytes[2] = ((b & 0x0f) << 4) | ((d >> 8) & 0x0f);
        bytes[3] = d & 0xff;
        break;
      }

      case 'SS': {
        // Two categories of SS:
        // Type 1 (Single Length): MVC, CLC -> D1(L,B1), D2(B2)
        // Type 2 (Two Lengths): PACK, UNPK, AP, SP, CP -> D1(L1,B1), D2(L2,B2)
        const isDecimal = ['PACK', 'UNPK', 'AP', 'SP', 'CP'].includes(mnemonic);

        if (isDecimal) {
          // Type 2: PACK D1(L1,B1), D2(L2,B2)
          const op1 = this.resolveAddressSSDecimal(opList[0] || '', currentLoc, lineNum);
          const op2 = this.resolveAddressSSDecimal(opList[1] || '', currentLoc, lineNum);

          // SS length bytes store length minus 1: L - 1
          const l1Code = Math.max(0, Math.min(15, op1.length - 1));
          const l2Code = Math.max(0, Math.min(15, op2.length - 1));

          bytes[1] = ((l1Code & 0x0f) << 4) | (l2Code & 0x0f);
          bytes[2] = ((op1.b & 0x0f) << 4) | ((op1.d >> 8) & 0x0f);
          bytes[3] = op1.d & 0xff;
          bytes[4] = ((op2.b & 0x0f) << 4) | ((op2.d >> 8) & 0x0f);
          bytes[5] = op2.d & 0xff;
        } else {
          // Type 1: MVC D1(L,B1), D2(B2)
          const op1 = this.resolveAddressSS(opList[0] || '', currentLoc, lineNum);
          const op2 = this.resolveAddressSSSecond(opList[1] || '', currentLoc, lineNum);

          // Length code is length minus 1 (0 to 255 represents 1 to 256 bytes)
          const lCode = Math.max(0, Math.min(255, op1.length - 1));

          bytes[1] = lCode & 0xff;
          bytes[2] = ((op1.b & 0x0f) << 4) | ((op1.d >> 8) & 0x0f);
          bytes[3] = op1.d & 0xff;
          bytes[4] = ((op2.b & 0x0f) << 4) | ((op2.d >> 8) & 0x0f);
          bytes[5] = op2.d & 0xff;
        }
        break;
      }

      default:
        throw new Error(`Unsupported format: ${spec.format}`);
    }

    return bytes;
  }

  // --- ADDRESS & BASE-DISPLACEMENT RESOLUTION ---

  private resolveAddressRX(operand: string, _currentLoc: number, lineNum: number): { d: number; x: number; b: number } {
    operand = operand.trim();

    // Check for explicit format: D(X, B) or D(B) or D(,B)
    const match = operand.match(/^(\d+)\s*\((?:(\w+)?\s*,\s*)?(\w+)\)$/);
    if (match) {
      const d = parseInt(match[1], 10);
      const x = match[2] ? this.resolveRegister(match[2], lineNum) : 0;
      const b = this.resolveRegister(match[3], lineNum);
      return { d, x, b };
    }

    // Check if numeric literal (e.g. LA R2, 5 -> absolute displacement, D=5, X=0, B=0)
    if (/^\d+$/.test(operand)) {
      const d = parseInt(operand, 10);
      return { d: d & 0xfff, x: 0, b: 0 };
    }

    // Check for symbol reference (e.g. TARGET)
    const sym = this.symbols[operand];
    if (sym !== undefined) {
      const targetAddr = sym.address;
      const { displacement, baseReg } = this.findBaseDisplacement(targetAddr);
      return { d: displacement, x: 0, b: baseReg };
    }

    throw new Error(`Undefined symbol or invalid address expression: '${operand}' at line ${lineNum}`);
  }

  private resolveAddressSI(operand: string, _currentLoc: number, lineNum: number): { d: number; b: number } {
    operand = operand.trim();
    const match = operand.match(/^(\d+)\s*\(\s*(\w+)\s*\)$/);
    if (match) {
      const d = parseInt(match[1], 10);
      const b = this.resolveRegister(match[2], lineNum);
      return { d, b };
    }

    const sym = this.symbols[operand];
    if (sym !== undefined) {
      const { displacement, baseReg } = this.findBaseDisplacement(sym.address);
      return { d: displacement, b: baseReg };
    }

    throw new Error(`Invalid SI storage operand: '${operand}' at line ${lineNum}`);
  }

  private resolveAddressSS(operand: string, _currentLoc: number, lineNum: number): { d: number; length: number; b: number } {
    operand = operand.trim();
    // D(L, B)
    const matchExplicit = operand.match(/^(\d+)\s*\(\s*(\d+)\s*,\s*(\w+)\s*\)$/);
    if (matchExplicit) {
      return {
        d: parseInt(matchExplicit[1], 10),
        length: parseInt(matchExplicit[2], 10),
        b: this.resolveRegister(matchExplicit[3], lineNum),
      };
    }

    // LABEL(L)
    const matchLabelLen = operand.match(/^(\w+)\s*\(\s*(\d+)\s*\)$/);
    if (matchLabelLen) {
      const sym = this.symbols[matchLabelLen[1]];
      if (!sym) throw new Error(`Undefined symbol '${matchLabelLen[1]}' at line ${lineNum}`);
      const len = parseInt(matchLabelLen[2], 10);
      const { displacement, baseReg } = this.findBaseDisplacement(sym.address);
      return { d: displacement, length: len, b: baseReg };
    }

    // Just LABEL (use symbol's defined length)
    const sym = this.symbols[operand];
    if (sym) {
      const { displacement, baseReg } = this.findBaseDisplacement(sym.address);
      return { d: displacement, length: Math.max(1, sym.length), b: baseReg };
    }

    throw new Error(`Invalid SS destination operand: '${operand}' at line ${lineNum}`);
  }

  private resolveAddressSSSecond(operand: string, _currentLoc: number, lineNum: number): { d: number; b: number } {
    operand = operand.trim();
    // D(B)
    const match = operand.match(/^(\d+)\s*\(\s*(\w+)\s*\)$/);
    if (match) {
      return {
        d: parseInt(match[1], 10),
        b: this.resolveRegister(match[2], lineNum),
      };
    }

    // LABEL
    const sym = this.symbols[operand];
    if (sym) {
      const { displacement, baseReg } = this.findBaseDisplacement(sym.address);
      return { d: displacement, b: baseReg };
    }

    throw new Error(`Invalid SS source operand: '${operand}' at line ${lineNum}`);
  }

  private resolveAddressSSDecimal(operand: string, _currentLoc: number, lineNum: number): { d: number; length: number; b: number } {
    operand = operand.trim();
    // D(L, B)
    const matchExplicit = operand.match(/^(\d+)\s*\(\s*(\d+)\s*,\s*(\w+)\s*\)$/);
    if (matchExplicit) {
      return {
        d: parseInt(matchExplicit[1], 10),
        length: parseInt(matchExplicit[2], 10),
        b: this.resolveRegister(matchExplicit[3], lineNum),
      };
    }

    // LABEL(L)
    const matchLabelLen = operand.match(/^(\w+)\s*\(\s*(\d+)\s*\)$/);
    if (matchLabelLen) {
      const sym = this.symbols[matchLabelLen[1]];
      if (!sym) throw new Error(`Undefined symbol '${matchLabelLen[1]}' at line ${lineNum}`);
      const len = parseInt(matchLabelLen[2], 10);
      const { displacement, baseReg } = this.findBaseDisplacement(sym.address);
      return { d: displacement, length: len, b: baseReg };
    }

    // Just LABEL
    const sym = this.symbols[operand];
    if (sym) {
      const { displacement, baseReg } = this.findBaseDisplacement(sym.address);
      return { d: displacement, length: Math.max(1, sym.length), b: baseReg };
    }

    throw new Error(`Invalid decimal operand: '${operand}' at line ${lineNum}`);
  }

  /**
   * Calculates displacement and selects the most appropriate active base register
   */
  private findBaseDisplacement(targetAddress: number): { displacement: number; baseReg: number } {
    let bestReg = -1;
    let minDisp = 999999;

    for (const entry of this.usingTable) {
      const disp = targetAddress - entry.baseAddress;
      if (disp >= 0 && disp <= 4095) {
        if (disp < minDisp) {
          minDisp = disp;
          bestReg = entry.register;
        }
      }
    }

    if (bestReg === -1) {
      // Default fallback: if no USING was established or out of range, assume base 12 at 0
      return { displacement: targetAddress & 0xfff, baseReg: 12 };
    }

    return { displacement: minDisp, baseReg: bestReg };
  }

  // --- DATA CONSTANT (DC) & STORAGE (DS) GENERATION ---

  private calculateDataLength(operands: string, _isDC: boolean): number {
    operands = operands.trim();
    // Examples: F'100', H'5', C'HELLO', CL10, PL4'123', 5F, X'FF00'
    const match = operands.match(/^(\d+)?([A-Z])(?:L(\d+))?(?:'(.*)')?$/);
    if (!match) return 4; // default fullword

    const dup = match[1] ? parseInt(match[1], 10) : 1;
    const type = match[2];
    const explicitLen = match[3] ? parseInt(match[3], 10) : undefined;
    const valStr = match[4] || '';

    let itemLen = 4;

    switch (type) {
      case 'F': // Fullword (4 bytes)
        itemLen = 4;
        break;
      case 'H': // Halfword (2 bytes)
        itemLen = 2;
        break;
      case 'C': // Character (EBCDIC)
        itemLen = explicitLen !== undefined ? explicitLen : valStr.length;
        break;
      case 'X': // Hex
        itemLen = explicitLen !== undefined ? explicitLen : Math.ceil(valStr.length / 2);
        break;
      case 'P': // Packed decimal
        if (explicitLen !== undefined) {
          itemLen = explicitLen;
        } else {
          // Digits + sign nibble / 2
          const digits = valStr.replace(/[^0-9]/g, '').length;
          itemLen = Math.floor((digits + 1 + 1) / 2);
        }
        break;
      case 'A': // Address (4 bytes)
        itemLen = 4;
        break;
    }

    return dup * itemLen;
  }

  private assembleDC(operands: string, lineNum: number): Uint8Array {
    operands = operands.trim();
    const match = operands.match(/^(\d+)?([A-Z])(?:L(\d+))?'(.*)'$/);
    if (!match) {
      throw new Error(`Malformed DC operand: '${operands}' at line ${lineNum}`);
    }

    const dup = match[1] ? parseInt(match[1], 10) : 1;
    const type = match[2];
    const explicitLen = match[3] ? parseInt(match[3], 10) : undefined;
    const val = match[4];

    let singleItem: Uint8Array;

    switch (type) {
      case 'F': {
        singleItem = new Uint8Array(4);
        const num = parseInt(val, 10);
        const view = new DataView(singleItem.buffer);
        view.setInt32(0, num, false); // Big endian
        break;
      }
      case 'H': {
        singleItem = new Uint8Array(2);
        const num = parseInt(val, 10);
        const view = new DataView(singleItem.buffer);
        view.setInt16(0, num, false); // Big endian
        break;
      }
      case 'C': {
        const len = explicitLen !== undefined ? explicitLen : val.length;
        singleItem = new Uint8Array(len);
        const ebcdic = asciiToEbcdic(val);
        // Copy and pad with EBCDIC spaces (0x40)
        for (let i = 0; i < len; i++) {
          singleItem[i] = i < ebcdic.length ? ebcdic[i] : 0x40;
        }
        break;
      }
      case 'X': {
        const hexDigits = val.replace(/[^0-9A-Fa-f]/g, '');
        const byteLen = explicitLen !== undefined ? explicitLen : Math.ceil(hexDigits.length / 2);
        singleItem = new Uint8Array(byteLen);
        const padded = hexDigits.padStart(byteLen * 2, '0');
        for (let i = 0; i < byteLen; i++) {
          singleItem[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
        }
        break;
      }
      case 'P': {
        // Packed decimal constant
        const digits = val.replace(/[^0-9-]/g, '');
        const num = BigInt(digits);
        const len = explicitLen !== undefined ? explicitLen : Math.ceil((Math.abs(Number(num)).toString().length + 1) / 2);
        singleItem = new Uint8Array(len);
        encodePacked(num, singleItem, 0, len);
        break;
      }
      default:
        throw new Error(`Unsupported DC constant type: '${type}' at line ${lineNum}`);
    }

    if (dup === 1) return singleItem;

    const res = new Uint8Array(singleItem.length * dup);
    for (let d = 0; d < dup; d++) {
      res.set(singleItem, d * singleItem.length);
    }
    return res;
  }

  // --- HELPERS ---

  private handleUsing(operands: string, loc: number, lineNum: number) {
    const parts = operands.split(',').map((s) => s.trim());
    if (parts.length < 2) {
      this.errors.push({ lineNum, message: 'USING requires base address and register' });
      return;
    }

    let baseAddr = loc;
    if (parts[0] !== '*') {
      const sym = this.symbols[parts[0]];
      baseAddr = sym !== undefined ? sym.address : parseInt(parts[0], 10) || 0;
    }

    const reg = this.resolveRegister(parts[1], lineNum);
    this.usingTable.push({ baseAddress: baseAddr, register: reg });
  }

  private handleDrop(operands: string) {
    const reg = parseInt(operands.trim().replace(/^R/i, ''), 10);
    this.usingTable = this.usingTable.filter((u) => u.register !== reg);
  }

  private resolveRegister(regStr: string, lineNum: number): number {
    regStr = regStr.trim();
    if (this.symbols[regStr] && this.symbols[regStr].type === 'EQU') {
      return this.symbols[regStr].value ?? 0;
    }
    const clean = regStr.replace(/^R/i, '');
    const num = parseInt(clean, 10);
    if (isNaN(num) || num < 0 || num > 15) {
      throw new Error(`Invalid register '${regStr}' at line ${lineNum} (must be 0-15)`);
    }
    return num;
  }

  private parseImmediateByte(immStr: string, lineNum: number): number {
    immStr = immStr.trim();
    // Character: C'A'
    const charMatch = immStr.match(/^C'(.)'$/);
    if (charMatch) {
      return asciiToEbcdic(charMatch[1])[0];
    }
    // Hex: X'40'
    const hexMatch = immStr.match(/^X'([0-9A-Fa-f]{1,2})'$/);
    if (hexMatch) {
      return parseInt(hexMatch[1], 16);
    }
    // Decimal
    const num = parseInt(immStr, 10);
    if (!isNaN(num)) return num & 0xff;

    throw new Error(`Invalid immediate byte operand: '${immStr}' at line ${lineNum}`);
  }

  private parseEquValue(operands: string): number {
    operands = operands.trim();
    if (operands === '*') return this.locationCounter;
    if (this.symbols[operands]) return this.symbols[operands].address;
    return parseInt(operands, 10) || 0;
  }

  private splitOperands(operandsStr: string): string[] {
    const ops: string[] = [];
    let current = '';
    let inQuote = false;
    let parenDepth = 0;

    for (let i = 0; i < operandsStr.length; i++) {
      const char = operandsStr[i];
      if (char === "'") inQuote = !inQuote;
      else if (char === '(' && !inQuote) parenDepth++;
      else if (char === ')' && !inQuote) parenDepth--;
      else if (char === ',' && !inQuote && parenDepth === 0) {
        ops.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) ops.push(current.trim());
    return ops;
  }

  private tokenizeLine(line: string): { label?: string; mnemonic: string; operands: string; isComment: boolean } | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Comments start with *
    if (line.startsWith('*') || trimmed.startsWith('*')) {
      return { isComment: true, mnemonic: '', operands: '' };
    }

    // Standard HLASM column formatting or whitespace separated:
    // If column 1 is non-space, it has a label
    let label: string | undefined;
    let rest = line;

    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      const match = line.match(/^(\S+)\s*(.*)$/);
      if (match) {
        label = match[1].toUpperCase();
        rest = match[2];
      }
    }

    const mnemonicMatch = rest.trim().match(/^(\S+)\s*(.*)$/);
    if (!mnemonicMatch) return null;

    const mnemonic = mnemonicMatch[1].toUpperCase();
    const operandsWithComments = mnemonicMatch[2].trim();

    // Strip trailing inline comments (separated by space after operands)
    let operands = '';
    let inQuote = false;
    let parenDepth = 0;
    for (let i = 0; i < operandsWithComments.length; i++) {
      const c = operandsWithComments[i];
      if (c === "'") inQuote = !inQuote;
      else if (c === '(' && !inQuote) parenDepth++;
      else if (c === ')' && !inQuote) parenDepth--;
      else if ((c === ' ' || c === '\t') && !inQuote && parenDepth === 0) {
        break; // Start of comment
      }
      operands += c;
    }

    return {
      label,
      mnemonic,
      operands: operands.trim(),
      isComment: false,
    };
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }
}
