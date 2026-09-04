/**
 * Core Data Structures & Interfaces for the IBM Mainframe Simulator
 */

export type ConditionCode = 0 | 1 | 2 | 3;

export const CC_DESCRIPTIONS: Record<ConditionCode, { short: string; desc: string }> = {
  0: { short: '0 (EQUAL / ZERO)', desc: 'Result zero, operands equal, or no overflow' },
  1: { short: '1 (LOW / NEGATIVE)', desc: 'Result negative or first operand is lower' },
  2: { short: '2 (HIGH / POSITIVE)', desc: 'Result positive or first operand is higher' },
  3: { short: '3 (OVERFLOW)', desc: 'Arithmetic overflow or special hardware condition' },
};

export interface ProgramStatusWord {
  instructionAddress: number; // Current memory location
  conditionCode: ConditionCode;
  halted: boolean;
  errorMessage: string | null;
}

export type InstructionFormat = 'RR' | 'RX' | 'RS' | 'SI' | 'SS' | 'PSEUDO';

export interface InstructionDef {
  mnemonic: string;
  opcode: number;
  format: InstructionFormat;
  length: number; // 2, 4, or 6 bytes
  description: string;
}

export interface SymbolEntry {
  name: string;
  address: number;
  length: number;
  type: 'LABEL' | 'EQU' | 'DC' | 'DS';
  value?: number;
}

export interface UsingEntry {
  baseAddress: number; // Address mapped to base register
  register: number;    // Base register 1..15
}

export interface ParsedInstruction {
  lineNum: number;
  sourceText: string;
  address: number;
  length: number;
  bytes: Uint8Array;
  mnemonic: string;
  operands: string;
  label?: string;
  comment?: string;
}

export interface AssemblyListingLine {
  lineNum: number;
  address: number;
  objectCode: string;
  sourceText: string;
  error?: string;
}

export interface AssemblyResult {
  success: boolean;
  listing: AssemblyListingLine[];
  instructions: ParsedInstruction[];
  symbols: Record<string, SymbolEntry>;
  errors: { lineNum: number; message: string }[];
  entryPoint: number;
  codeLength: number;
}

export interface MemoryAccess {
  address: number;
  length: number;
  type: 'READ' | 'WRITE' | 'EXECUTE';
}

export interface CPUSnapshot {
  registers: number[];
  psw: ProgramStatusWord;
  memory: Uint8Array;
  lastAccess: MemoryAccess[];
  lastInstruction: ParsedInstruction | null;
}
