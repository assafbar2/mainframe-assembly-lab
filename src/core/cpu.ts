/**
 * Virtual IBM Mainframe CPU
 * Simulates 16 GPRs, PSW with 2-bit CC, 64KB Big-Endian memory,
 * instruction decoding, memory delta tracking, and step-back history.
 */

import {
  execAddPacked,
  execComparePacked,
  execPack,
  execSubPacked,
  execUnpack,
} from './packedDecimal';
import type {
  CPUSnapshot,
  MemoryAccess,
  ParsedInstruction,
  ProgramStatusWord,
} from './types';

export class MainframeCPU {
  public memory: Uint8Array;
  public registers: Int32Array; // 16 32-bit registers
  public psw: ProgramStatusWord;
  public lastAccesses: MemoryAccess[] = [];
  public lastInstruction: ParsedInstruction | null = null;
  public stepCount = 0;

  private instructionMap: Map<number, ParsedInstruction> = new Map();
  private history: CPUSnapshot[] = [];
  private readonly MAX_HISTORY = 200;

  constructor(memorySize = 65536) {
    this.memory = new Uint8Array(memorySize);
    this.registers = new Int32Array(16);
    this.psw = {
      instructionAddress: 0,
      conditionCode: 0,
      halted: false,
      errorMessage: null,
    };
  }

  /**
   * Resets the CPU state and memory
   */
  public reset(clearMemory = true) {
    if (clearMemory) {
      this.memory.fill(0);
    }
    this.registers.fill(0);
    this.psw = {
      instructionAddress: 0,
      conditionCode: 0,
      halted: false,
      errorMessage: null,
    };
    this.lastAccesses = [];
    this.lastInstruction = null;
    this.history = [];
    this.stepCount = 0;
  }

  /**
   * Loads assembled instructions into memory and sets up instruction map
   */
  public loadProgram(instructions: ParsedInstruction[], entryPoint = 0) {
    this.reset(true);
    this.instructionMap.clear();

    for (const inst of instructions) {
      this.memory.set(inst.bytes, inst.address);
      // Map address to parsed instruction for UI tracking
      this.instructionMap.set(inst.address, inst);
    }

    this.psw.instructionAddress = entryPoint;
  }

  /**
   * Saves snapshot for step-back time-travel debugging
   */
  private pushHistory() {
    if (this.history.length >= this.MAX_HISTORY) {
      this.history.shift();
    }
    this.history.push({
      registers: Array.from(this.registers),
      psw: { ...this.psw },
      memory: new Uint8Array(this.memory),
      lastAccess: [...this.lastAccesses],
      lastInstruction: this.lastInstruction,
    });
  }

  /**
   * Steps backward in time to previous execution state
   */
  public stepBack(): boolean {
    const prior = this.history.pop();
    if (!prior) return false;

    for (let i = 0; i < 16; i++) {
      this.registers[i] = prior.registers[i];
    }
    this.psw = { ...prior.psw };
    this.memory.set(prior.memory);
    this.lastAccesses = [...prior.lastAccess];
    this.lastInstruction = prior.lastInstruction;
    this.stepCount = Math.max(0, this.stepCount - 1);
    return true;
  }

  public get canStepBack(): boolean {
    return this.history.length > 0;
  }

  /**
   * Executes a single instruction at current PSW address
   */
  public step(): boolean {
    if (this.psw.halted) return false;

    const currentAddr = this.psw.instructionAddress;
    if (currentAddr < 0 || currentAddr >= this.memory.length - 2) {
      this.psw.halted = true;
      this.psw.errorMessage = `Instruction address 0x${currentAddr.toString(16)} is out of memory range`;
      return false;
    }

    // Save history prior to mutation
    this.pushHistory();
    this.lastAccesses = [];

    const opcode = this.memory[currentAddr];

    // If opcode is 0x00 or uninitialized, check if we hit end or BR 14 exit
    if (opcode === 0x00) {
      this.psw.halted = true;
      this.psw.errorMessage = 'Execution terminated (Zero Opcode / Normal End)';
      return false;
    }

    // Find parsed instruction reference if available
    this.lastInstruction = this.instructionMap.get(currentAddr) || null;

    try {
      this.executeOpcode(opcode, currentAddr);
      this.stepCount++;
      return !this.psw.halted;
    } catch (err: any) {
      this.psw.halted = true;
      this.psw.errorMessage = err.message || 'Execution error';
      return false;
    }
  }

  private executeOpcode(opcode: number, pc: number) {
    const mem = this.memory;
    const view = new DataView(mem.buffer);

    switch (opcode) {
      // --- RR INSTRUCTIONS (2 bytes) ---

      case 0x18: {
        // LR R1, R2
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        this.registers[r1] = this.registers[r2];
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x1a: {
        // AR R1, R2
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        const v1 = this.registers[r1];
        const v2 = this.registers[r2];
        const sum = v1 + v2;
        this.registers[r1] = sum | 0;
        this.setAddSubCC(v1, v2, sum, false);
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x1b: {
        // SR R1, R2
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        const v1 = this.registers[r1];
        const v2 = this.registers[r2];
        const diff = v1 - v2;
        this.registers[r1] = diff | 0;
        this.setAddSubCC(v1, v2, diff, true);
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x1c: {
        // MR R1, R2 (Even/Odd pair)
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        if (r1 % 2 !== 0) throw new Error('MR requires even-numbered first register');
        const multiplicand = BigInt(this.registers[r1 + 1]);
        const multiplier = BigInt(this.registers[r2]);
        const product = multiplicand * multiplier;
        // Upper 32 bits into R1, lower 32 bits into R1+1
        this.registers[r1] = Number((product >> 32n) & 0xffffffffn) | 0;
        this.registers[r1 + 1] = Number(product & 0xffffffffn) | 0;
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x1d: {
        // DR R1, R2 (Even/Odd pair)
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        if (r1 % 2 !== 0) throw new Error('DR requires even-numbered first register');
        const divisor = BigInt(this.registers[r2]);
        if (divisor === 0n) throw new Error('Divide by zero exception');
        const dividend = (BigInt(this.registers[r1]) << 32n) | (BigInt(this.registers[r1 + 1]) & 0xffffffffn);
        const quotient = dividend / divisor;
        const remainder = dividend % divisor;
        this.registers[r1] = Number(remainder & 0xffffffffn) | 0; // Remainder in even register
        this.registers[r1 + 1] = Number(quotient & 0xffffffffn) | 0; // Quotient in odd register
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x19: {
        // CR R1, R2
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        const v1 = this.registers[r1];
        const v2 = this.registers[r2];
        if (v1 === v2) this.psw.conditionCode = 0;
        else if (v1 < v2) this.psw.conditionCode = 1;
        else this.psw.conditionCode = 2;
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x14: {
        // NR R1, R2 (AND)
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        this.registers[r1] &= this.registers[r2];
        this.psw.conditionCode = this.registers[r1] === 0 ? 0 : 1;
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x16: {
        // OR R1, R2 (OR)
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        this.registers[r1] |= this.registers[r2];
        this.psw.conditionCode = this.registers[r1] === 0 ? 0 : 1;
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x17: {
        // XR R1, R2 (XOR)
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        this.registers[r1] ^= this.registers[r2];
        this.psw.conditionCode = this.registers[r1] === 0 ? 0 : 1;
        this.psw.instructionAddress = pc + 2;
        break;
      }

      case 0x07: {
        // BCR M1, R2
        const b = mem[pc + 1];
        const m1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        // Standard branch test: (M1 & (8 >> CC)) != 0
        const testMask = 8 >> this.psw.conditionCode;
        if ((m1 & testMask) !== 0 && r2 !== 0) {
          const target = this.registers[r2] & 0x00ffffff; // 24-bit/31-bit address
          if (r2 === 14 && target === 0) {
            // Standard return exit convention (BR 14 to return)
            this.psw.halted = true;
            this.psw.errorMessage = 'Normal program exit (BR 14 executed)';
            return;
          }
          this.psw.instructionAddress = target;
        } else {
          this.psw.instructionAddress = pc + 2;
        }
        break;
      }

      case 0x05: {
        // BALR R1, R2
        const b = mem[pc + 1];
        const r1 = (b >> 4) & 0x0f;
        const r2 = b & 0x0f;
        const nextAddr = pc + 2;
        this.registers[r1] = nextAddr;
        if (r2 !== 0) {
          this.psw.instructionAddress = this.registers[r2] & 0x00ffffff;
        } else {
          this.psw.instructionAddress = nextAddr;
        }
        break;
      }

      // --- RX INSTRUCTIONS (4 bytes) ---

      case 0x58: {
        // L R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        this.registers[r1] = view.getInt32(ea, false);
        this.recordAccess(ea, 4, 'READ');
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x50: {
        // ST R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        view.setInt32(ea, this.registers[r1], false);
        this.recordAccess(ea, 4, 'WRITE');
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x5a: {
        // A R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        const memVal = view.getInt32(ea, false);
        this.recordAccess(ea, 4, 'READ');
        const v1 = this.registers[r1];
        const sum = v1 + memVal;
        this.registers[r1] = sum | 0;
        this.setAddSubCC(v1, memVal, sum, false);
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x5b: {
        // S R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        const memVal = view.getInt32(ea, false);
        this.recordAccess(ea, 4, 'READ');
        const v1 = this.registers[r1];
        const diff = v1 - memVal;
        this.registers[r1] = diff | 0;
        this.setAddSubCC(v1, memVal, diff, true);
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x59: {
        // C R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        const memVal = view.getInt32(ea, false);
        this.recordAccess(ea, 4, 'READ');
        const v1 = this.registers[r1];
        if (v1 === memVal) this.psw.conditionCode = 0;
        else if (v1 < memVal) this.psw.conditionCode = 1;
        else this.psw.conditionCode = 2;
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x41: {
        // LA R1, D(X, B) - Load Address
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        this.registers[r1] = ea & 0x7fffffff;
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x48: {
        // LH R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        this.registers[r1] = view.getInt16(ea, false);
        this.recordAccess(ea, 2, 'READ');
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x40: {
        // STH R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        view.setInt16(ea, this.registers[r1] & 0xffff, false);
        this.recordAccess(ea, 2, 'WRITE');
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x47: {
        // BC M1, D(X, B)
        const m1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        const testMask = 8 >> this.psw.conditionCode;
        if ((m1 & testMask) !== 0) {
          this.psw.instructionAddress = ea;
        } else {
          this.psw.instructionAddress = pc + 4;
        }
        break;
      }

      case 0x45: {
        // BAL R1, D(X, B)
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        this.registers[r1] = pc + 4;
        this.psw.instructionAddress = ea;
        break;
      }

      case 0x46: {
        // BCT R1, D(X, B) - Branch on Count
        const r1 = (mem[pc + 1] >> 4) & 0x0f;
        const ea = this.computeEffectiveAddressRX(pc);
        this.registers[r1] = (this.registers[r1] - 1) | 0;
        if (this.registers[r1] !== 0) {
          this.psw.instructionAddress = ea;
        } else {
          this.psw.instructionAddress = pc + 4;
        }
        break;
      }

      // --- SI INSTRUCTIONS (4 bytes) ---

      case 0x92: {
        // MVI D(B), I
        const imm = mem[pc + 1];
        const b = (mem[pc + 2] >> 4) & 0x0f;
        const d = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea = ((b !== 0 ? this.registers[b] : 0) + d) & 0x00ffffff;
        mem[ea] = imm;
        this.recordAccess(ea, 1, 'WRITE');
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x95: {
        // CLI D(B), I
        const imm = mem[pc + 1];
        const b = (mem[pc + 2] >> 4) & 0x0f;
        const d = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea = ((b !== 0 ? this.registers[b] : 0) + d) & 0x00ffffff;
        const memByte = mem[ea];
        this.recordAccess(ea, 1, 'READ');
        if (memByte === imm) this.psw.conditionCode = 0;
        else if (memByte < imm) this.psw.conditionCode = 1;
        else this.psw.conditionCode = 2;
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x94: {
        // NI D(B), I (AND)
        const imm = mem[pc + 1];
        const b = (mem[pc + 2] >> 4) & 0x0f;
        const d = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea = ((b !== 0 ? this.registers[b] : 0) + d) & 0x00ffffff;
        mem[ea] &= imm;
        this.recordAccess(ea, 1, 'WRITE');
        this.psw.conditionCode = mem[ea] === 0 ? 0 : 1;
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x96: {
        // OI D(B), I (OR)
        const imm = mem[pc + 1];
        const b = (mem[pc + 2] >> 4) & 0x0f;
        const d = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea = ((b !== 0 ? this.registers[b] : 0) + d) & 0x00ffffff;
        mem[ea] |= imm;
        this.recordAccess(ea, 1, 'WRITE');
        this.psw.conditionCode = mem[ea] === 0 ? 0 : 1;
        this.psw.instructionAddress = pc + 4;
        break;
      }

      case 0x97: {
        // XI D(B), I (XOR)
        const imm = mem[pc + 1];
        const b = (mem[pc + 2] >> 4) & 0x0f;
        const d = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea = ((b !== 0 ? this.registers[b] : 0) + d) & 0x00ffffff;
        mem[ea] ^= imm;
        this.recordAccess(ea, 1, 'WRITE');
        this.psw.conditionCode = mem[ea] === 0 ? 0 : 1;
        this.psw.instructionAddress = pc + 4;
        break;
      }

      // --- SS INSTRUCTIONS (6 bytes) ---

      case 0xd2: {
        // MVC D1(L, B1), D2(B2)
        const l = mem[pc + 1] + 1; // 0 to 255 represents 1 to 256 bytes
        const b1 = (mem[pc + 2] >> 4) & 0x0f;
        const d1 = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea1 = ((b1 !== 0 ? this.registers[b1] : 0) + d1) & 0x00ffffff;

        const b2 = (mem[pc + 4] >> 4) & 0x0f;
        const d2 = ((mem[pc + 4] & 0x0f) << 8) | mem[pc + 5];
        const ea2 = ((b2 !== 0 ? this.registers[b2] : 0) + d2) & 0x00ffffff;

        // Byte-by-byte left to right copy (handles overlapping string fills like MVC STR+1(9),STR)
        for (let i = 0; i < l; i++) {
          mem[ea1 + i] = mem[ea2 + i];
        }
        this.recordAccess(ea2, l, 'READ');
        this.recordAccess(ea1, l, 'WRITE');
        this.psw.instructionAddress = pc + 6;
        break;
      }

      case 0xd5: {
        // CLC D1(L, B1), D2(B2)
        const l = mem[pc + 1] + 1;
        const b1 = (mem[pc + 2] >> 4) & 0x0f;
        const d1 = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea1 = ((b1 !== 0 ? this.registers[b1] : 0) + d1) & 0x00ffffff;

        const b2 = (mem[pc + 4] >> 4) & 0x0f;
        const d2 = ((mem[pc + 4] & 0x0f) << 8) | mem[pc + 5];
        const ea2 = ((b2 !== 0 ? this.registers[b2] : 0) + d2) & 0x00ffffff;

        let diff = 0;
        for (let i = 0; i < l; i++) {
          if (mem[ea1 + i] !== mem[ea2 + i]) {
            diff = mem[ea1 + i] - mem[ea2 + i];
            break;
          }
        }
        this.recordAccess(ea1, l, 'READ');
        this.recordAccess(ea2, l, 'READ');
        if (diff === 0) this.psw.conditionCode = 0;
        else if (diff < 0) this.psw.conditionCode = 1;
        else this.psw.conditionCode = 2;
        this.psw.instructionAddress = pc + 6;
        break;
      }

      case 0xf2: {
        // PACK D1(L1, B1), D2(L2, B2)
        const l1 = ((mem[pc + 1] >> 4) & 0x0f) + 1;
        const l2 = (mem[pc + 1] & 0x0f) + 1;
        const b1 = (mem[pc + 2] >> 4) & 0x0f;
        const d1 = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea1 = ((b1 !== 0 ? this.registers[b1] : 0) + d1) & 0x00ffffff;

        const b2 = (mem[pc + 4] >> 4) & 0x0f;
        const d2 = ((mem[pc + 4] & 0x0f) << 8) | mem[pc + 5];
        const ea2 = ((b2 !== 0 ? this.registers[b2] : 0) + d2) & 0x00ffffff;

        execPack(mem, ea1, l1, ea2, l2);
        this.recordAccess(ea2, l2, 'READ');
        this.recordAccess(ea1, l1, 'WRITE');
        this.psw.instructionAddress = pc + 6;
        break;
      }

      case 0xf3: {
        // UNPK D1(L1, B1), D2(L2, B2)
        const l1 = ((mem[pc + 1] >> 4) & 0x0f) + 1;
        const l2 = (mem[pc + 1] & 0x0f) + 1;
        const b1 = (mem[pc + 2] >> 4) & 0x0f;
        const d1 = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea1 = ((b1 !== 0 ? this.registers[b1] : 0) + d1) & 0x00ffffff;

        const b2 = (mem[pc + 4] >> 4) & 0x0f;
        const d2 = ((mem[pc + 4] & 0x0f) << 8) | mem[pc + 5];
        const ea2 = ((b2 !== 0 ? this.registers[b2] : 0) + d2) & 0x00ffffff;

        execUnpack(mem, ea1, l1, ea2, l2);
        this.recordAccess(ea2, l2, 'READ');
        this.recordAccess(ea1, l1, 'WRITE');
        this.psw.instructionAddress = pc + 6;
        break;
      }

      case 0xfa: {
        // AP D1(L1, B1), D2(L2, B2)
        const l1 = ((mem[pc + 1] >> 4) & 0x0f) + 1;
        const l2 = (mem[pc + 1] & 0x0f) + 1;
        const b1 = (mem[pc + 2] >> 4) & 0x0f;
        const d1 = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea1 = ((b1 !== 0 ? this.registers[b1] : 0) + d1) & 0x00ffffff;

        const b2 = (mem[pc + 4] >> 4) & 0x0f;
        const d2 = ((mem[pc + 4] & 0x0f) << 8) | mem[pc + 5];
        const ea2 = ((b2 !== 0 ? this.registers[b2] : 0) + d2) & 0x00ffffff;

        const { cc } = execAddPacked(mem, ea1, l1, ea2, l2);
        this.psw.conditionCode = cc;
        this.recordAccess(ea2, l2, 'READ');
        this.recordAccess(ea1, l1, 'WRITE');
        this.psw.instructionAddress = pc + 6;
        break;
      }

      case 0xfb: {
        // SP D1(L1, B1), D2(L2, B2)
        const l1 = ((mem[pc + 1] >> 4) & 0x0f) + 1;
        const l2 = (mem[pc + 1] & 0x0f) + 1;
        const b1 = (mem[pc + 2] >> 4) & 0x0f;
        const d1 = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea1 = ((b1 !== 0 ? this.registers[b1] : 0) + d1) & 0x00ffffff;

        const b2 = (mem[pc + 4] >> 4) & 0x0f;
        const d2 = ((mem[pc + 4] & 0x0f) << 8) | mem[pc + 5];
        const ea2 = ((b2 !== 0 ? this.registers[b2] : 0) + d2) & 0x00ffffff;

        const { cc } = execSubPacked(mem, ea1, l1, ea2, l2);
        this.psw.conditionCode = cc;
        this.recordAccess(ea2, l2, 'READ');
        this.recordAccess(ea1, l1, 'WRITE');
        this.psw.instructionAddress = pc + 6;
        break;
      }

      case 0xf9: {
        // CP D1(L1, B1), D2(L2, B2)
        const l1 = ((mem[pc + 1] >> 4) & 0x0f) + 1;
        const l2 = (mem[pc + 1] & 0x0f) + 1;
        const b1 = (mem[pc + 2] >> 4) & 0x0f;
        const d1 = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];
        const ea1 = ((b1 !== 0 ? this.registers[b1] : 0) + d1) & 0x00ffffff;

        const b2 = (mem[pc + 4] >> 4) & 0x0f;
        const d2 = ((mem[pc + 4] & 0x0f) << 8) | mem[pc + 5];
        const ea2 = ((b2 !== 0 ? this.registers[b2] : 0) + d2) & 0x00ffffff;

        const { cc } = execComparePacked(mem, ea1, l1, ea2, l2);
        this.psw.conditionCode = cc;
        this.recordAccess(ea1, l1, 'READ');
        this.recordAccess(ea2, l2, 'READ');
        this.psw.instructionAddress = pc + 6;
        break;
      }

      default:
        throw new Error(`Unimplemented or illegal opcode 0x${opcode.toString(16).padStart(2, '0').toUpperCase()} at address 0x${pc.toString(16)}`);
    }
  }

  private computeEffectiveAddressRX(pc: number): number {
    const mem = this.memory;
    const x = mem[pc + 1] & 0x0f;
    const b = (mem[pc + 2] >> 4) & 0x0f;
    const d = ((mem[pc + 2] & 0x0f) << 8) | mem[pc + 3];

    const baseVal = b !== 0 ? this.registers[b] : 0;
    const indexVal = x !== 0 ? this.registers[x] : 0;

    return (baseVal + indexVal + d) & 0x00ffffff;
  }

  private setAddSubCC(op1: number, op2: number, res: number, isSub: boolean) {
    // 32-bit overflow check
    let overflow = false;
    if (!isSub) {
      if ((op1 > 0 && op2 > 0 && res < 0) || (op1 < 0 && op2 < 0 && res >= 0)) {
        overflow = true;
      }
    } else {
      if ((op1 > 0 && op2 < 0 && res < 0) || (op1 < 0 && op2 > 0 && res >= 0)) {
        overflow = true;
      }
    }

    if (overflow) {
      this.psw.conditionCode = 3;
    } else if (res === 0) {
      this.psw.conditionCode = 0;
    } else if (res < 0) {
      this.psw.conditionCode = 1;
    } else {
      this.psw.conditionCode = 2;
    }
  }

  private recordAccess(address: number, length: number, type: 'READ' | 'WRITE' | 'EXECUTE') {
    this.lastAccesses.push({ address, length, type });
  }
}
