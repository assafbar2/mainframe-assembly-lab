import { describe, expect, it } from 'vitest';
import { Assembler } from './assembler';
import { MainframeCPU } from './cpu';
import { asciiToEbcdic, ebcdicToAscii } from './ebcdic';
import {
  decodePacked,
  encodePacked,
  execAddPacked,
  execPack,
  execUnpack,
  zonedToNumber,
} from './packedDecimal';

describe('EBCDIC Translation', () => {
  it('converts ASCII characters to IBM EBCDIC CP037 correctly', () => {
    const ebcdic = asciiToEbcdic('IBM');
    // 'I' = 0xC9, 'B' = 0xC2, 'M' = 0xD4
    expect(ebcdic[0]).toBe(0xc9);
    expect(ebcdic[1]).toBe(0xc2);
    expect(ebcdic[2]).toBe(0xd4);
  });

  it('converts EBCDIC space and digits accurately', () => {
    const ebcdic = asciiToEbcdic(' 123');
    // Space is 0x40 in EBCDIC
    expect(ebcdic[0]).toBe(0x40);
    // Digits are 0xF1, 0xF2, 0xF3
    expect(ebcdic[1]).toBe(0xf1);
    expect(ebcdic[2]).toBe(0xf2);
    expect(ebcdic[3]).toBe(0xf3);

    const backToAscii = ebcdicToAscii(ebcdic);
    expect(backToAscii).toBe(' 123');
  });
});

describe('Packed Decimal Arithmetic', () => {
  it('encodes and decodes positive and negative packed numbers', () => {
    const mem = new Uint8Array(4);
    // +1234567 into 4 bytes -> 0x01 0x23 0x45 0x67 (wait, 7 digits + sign fits in 4 bytes: 0x12 0x34 0x56 0x7C)
    encodePacked(1234567n, mem, 0, 4);
    const decoded = decodePacked(mem, 0, 4);
    expect(decoded.value).toBe(1234567n);
    expect(decoded.isNegative).toBe(false);

    // Negative -456 into 3 bytes
    encodePacked(-456n, mem, 0, 3);
    const decodedNeg = decodePacked(mem, 0, 3);
    expect(decodedNeg.value).toBe(-456n);
    expect(decodedNeg.isNegative).toBe(true);
  });

  it('packs zoned decimal string and unpacks it back', () => {
    const mem = new Uint8Array(32);
    // Write zoned '1234' in EBCDIC into mem at offset 0
    const zoned = asciiToEbcdic('1234');
    mem.set(zoned, 0);

    // PACK 3 bytes at offset 10 from 4 bytes at offset 0
    // Result should be 0x01 0x23 0x4C
    execPack(mem, 10, 3, 0, 4);

    expect(mem[10]).toBe(0x01);
    expect(mem[11]).toBe(0x23);
    expect(mem[12]).toBe(0x4c);

    // UNPK into offset 20 (4 bytes)
    // Authentic IBM S/360: Last byte holds sign 0xC in high zone: 0xC4
    execUnpack(mem, 20, 4, 10, 3);
    expect(mem[20]).toBe(0xf1); // '1'
    expect(mem[21]).toBe(0xf2); // '2'
    expect(mem[22]).toBe(0xf3); // '3'
    expect(mem[23]).toBe(0xc4); // '4' with positive sign 0xC

    // Decoded with zonedToNumber
    const decoded = zonedToNumber(mem, 20, 4);
    expect(decoded.value).toBe(1234);

    // If mainframe programmer applies OI to make it printable ASCII:
    mem[23] |= 0xf0; // 0xC4 | 0xF0 = 0xF4 ('4')
    const resultStr = ebcdicToAscii(mem.subarray(20, 24));
    expect(resultStr).toBe('1234');
  });

  it('performs exact decimal addition without floating point error', () => {
    const mem = new Uint8Array(16);
    // Amount 1: $10.50 -> 1050 (in 3 bytes: 0x01 0x05 0x0C)
    encodePacked(1050n, mem, 0, 3);
    // Amount 2: $0.25 -> 25 (in 2 bytes: 0x02 0x5C)
    encodePacked(25n, mem, 4, 2);

    // AP: mem[0..2] += mem[4..5]
    const { cc } = execAddPacked(mem, 0, 3, 4, 2);
    expect(cc).toBe(2); // Positive result

    const finalVal = decodePacked(mem, 0, 3);
    expect(finalVal.value).toBe(1075n); // $10.75 exactly!
  });
});

describe('Two-Pass Assembler', () => {
  it('assembles RR register instructions', () => {
    const asm = new Assembler();
    const src = `
TEST     CSECT
         LR    R2,R3
         AR    R2,R4
         SR    R2,R5
         END
    `;
    const res = asm.assemble(src);
    expect(res.success).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.instructions.length).toBe(3);

    // LR R2, R3 -> 0x18, 0x23
    expect(res.instructions[0].bytes[0]).toBe(0x18);
    expect(res.instructions[0].bytes[1]).toBe(0x23);

    // AR R2, R4 -> 0x1A, 0x24
    expect(res.instructions[1].bytes[0]).toBe(0x1a);
    expect(res.instructions[1].bytes[1]).toBe(0x24);
  });

  it('resolves Base-Displacement addressing with USING directive', () => {
    const asm = new Assembler();
    const src = `
TEST     CSECT
         BALR  R12,0
         USING *,R12
         L     R2,MYVAL
         ST    R2,RESULT
MYVAL    DC    F'100'
RESULT   DS    F
         END
    `;
    const res = asm.assemble(src);
    expect(res.success).toBe(true);

    // BALR R12,0 is at address 0 (2 bytes)
    // USING *,R12 establishes R12 = address 2
    // L R2,MYVAL is at address 2 (4 bytes)
    // ST R2,RESULT is at address 6 (4 bytes)
    // MYVAL is at address 10 (0x000A)
    // Displacement for MYVAL from R12 (addr 2) is 10 - 2 = 8 bytes
    const lInst = res.instructions[1];
    expect(lInst.mnemonic).toBe('L');
    expect(lInst.bytes[0]).toBe(0x58); // L opcode
    // Byte 1: R1=2, X=0 -> 0x20
    expect(lInst.bytes[1]).toBe(0x20);
    // Base reg is 12 (0xC)
    const baseReg = (lInst.bytes[2] >> 4) & 0x0f;
    expect(baseReg).toBe(12);
    // Displacement should be 8
    const disp = ((lInst.bytes[2] & 0x0f) << 8) | lInst.bytes[3];
    expect(disp).toBe(8);
  });
});

describe('Mainframe CPU Execution', () => {
  it('executes arithmetic and condition codes accurately', () => {
    const asm = new Assembler();
    const cpu = new MainframeCPU();

    const src = `
MATH     CSECT
         LR    R2,R0
         AR    R2,R1
         CR    R2,R0
         END
    `;
    const res = asm.assemble(src);
    expect(res.success).toBe(true);

    cpu.loadProgram(res.instructions);
    cpu.registers[0] = 50;
    cpu.registers[1] = 25;

    // Step 1: LR R2, R0 -> R2 = 50
    cpu.step();
    expect(cpu.registers[2]).toBe(50);

    // Step 2: AR R2, R1 -> R2 = 75, CC = 2 (Positive)
    cpu.step();
    expect(cpu.registers[2]).toBe(75);
    expect(cpu.psw.conditionCode).toBe(2);

    // Step 3: CR R2, R0 -> Compares 75 to 50 -> R2 > R0, so CC = 2
    cpu.step();
    expect(cpu.psw.conditionCode).toBe(2);
  });

  it('supports Time Travel debugging with stepBack()', () => {
    const asm = new Assembler();
    const cpu = new MainframeCPU();

    const src = `
STEPTEST CSECT
         LR    R2,R0
         AR    R2,R1
         END
    `;
    const res = asm.assemble(src);
    cpu.loadProgram(res.instructions);
    cpu.registers[0] = 10;
    cpu.registers[1] = 5;

    cpu.step(); // R2 = 10
    expect(cpu.registers[2]).toBe(10);

    cpu.step(); // R2 = 15
    expect(cpu.registers[2]).toBe(15);

    // Undo step!
    const ok = cpu.stepBack();
    expect(ok).toBe(true);
    expect(cpu.registers[2]).toBe(10);
    expect(cpu.psw.instructionAddress).toBe(2);
  });

  it('executes Storage-to-Storage MVC string copy', () => {
    const asm = new Assembler();
    const cpu = new MainframeCPU();

    const src = `
COPY     CSECT
         BALR  R12,0
         USING *,R12
         MVC   DEST(4),SRC
         BR    R14
SRC      DC    C'IBMZ'
DEST     DS    CL4
         END
    `;
    const res = asm.assemble(src);
    expect(res.success).toBe(true);

    cpu.loadProgram(res.instructions);
    // Step until halted or done
    while (!cpu.psw.halted) {
      cpu.step();
    }

    const destSym = res.symbols['DEST'];
    expect(destSym).toBeDefined();

    const destBytes = cpu.memory.subarray(destSym.address, destSym.address + 4);
    const text = ebcdicToAscii(destBytes);
    expect(text).toBe('IBMZ');
  });

  it('executes loop with Branch on Count (BCT)', () => {
    const asm = new Assembler();
    const cpu = new MainframeCPU();

    const src = `
LOOPTEST CSECT
         BALR  R12,0
         USING *,R12
         LA    R2,5        * Counter = 5
         LA    R3,0        * Accumulator = 0
LOOP     LA    R3,10(0,R3) * Add 10 to R3
         BCT   R2,LOOP     * Decrement R2, branch if > 0
         BR    R14
         END
    `;
    const res = asm.assemble(src);
    expect(res.success).toBe(true);

    cpu.loadProgram(res.instructions);
    let steps = 0;
    while (!cpu.psw.halted && steps < 100) {
      cpu.step();
      steps++;
    }

    expect(cpu.registers[2]).toBe(0); // Counter finished at 0
    expect(cpu.registers[3]).toBe(50); // 5 iterations * 10 = 50
  });
});
