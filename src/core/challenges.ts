/**
 * Educational Missions & Challenges
 * Guided, hands-on progressive puzzles teaching IBM Mainframe Assembly concepts.
 */

import { Assembler } from './assembler';
import { MainframeCPU } from './cpu';
import { ebcdicToAscii } from './ebcdic';
import { zonedToNumber } from './packedDecimal';

export interface MissionTestAssertion {
  description: string;
  check: (cpu: MainframeCPU, res: any) => { passed: boolean; expected: string; actual: string };
}

export interface Mission {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  category: 'REGISTERS' | 'ADDRESSING' | 'STORAGE' | 'DECIMAL' | 'LOOPS';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  briefing: string;
  conceptExplainer: {
    heading: string;
    text: string;
    codeSnippet?: string;
  };
  starterCode: string;
  solutionCode: string;
  hints: string[];
  assertions: MissionTestAssertion[];
}

export const MISSIONS: Mission[] = [
  {
    id: 'mission-1',
    number: 1,
    title: 'The Register Ledger',
    subtitle: 'Mastering R0-R15 and Register-to-Register (RR) Math',
    category: 'REGISTERS',
    difficulty: 'Beginner',
    estimatedTime: '3 min',
    briefing: `Welcome to the IBM System/360 central processor! The mainframe provides 16 General Purpose Registers numbered R0 through R15, each holding a 32-bit signed integer.

Your task:
1. You are given initial values in R2 (500) and R3 (350).
2. Copy R2 into R15, then add R3 to R15 so R15 holds their sum (850).
3. Copy R2 into R1, then subtract R3 from R1 so R1 holds their difference (150).
4. Exit using BR R14.`,
    conceptExplainer: {
      heading: 'RR Format: Fast Register Operations',
      text: `RR instructions are 2 bytes long and execute purely inside processor registers:
• LR R1, R2 copies the contents of R2 into R1.
• AR R1, R2 adds R2 to R1 (R1 = R1 + R2).
• SR R1, R2 subtracts R2 from R1 (R1 = R1 - R2).
• BR R14 returns to the operating system caller.`,
      codeSnippet: `* Copy R2 into R15 and add R3:
         LR    R15,R2      * R15 = 500
         AR    R15,R3      * R15 = 500 + 350 = 850`,
    },
    starterCode: `* ====================================================================
* MISSION 1: THE REGISTER LEDGER
* Calculate R15 = R2 + R3 and R1 = R2 - R3
* ====================================================================
LEDGER   CSECT
* (Note: R2 and R3 are pre-loaded by the test harness with 500 and 350)

* TODO: Put your instructions here!
* 1. Copy R2 to R15, then add R3 to R15
* 2. Copy R2 to R1, then subtract R3 from R1



         BR    R14         * Return to supervisor
         END   LEDGER
`,
    solutionCode: `LEDGER   CSECT
         LR    R15,R2      * R15 = R2 (500)
         AR    R15,R3      * R15 = 500 + 350 = 850
         LR    R1,R2       * R1 = R2 (500)
         SR    R1,R3       * R1 = 500 - 350 = 150
         BR    R14
         END   LEDGER`,
    hints: [
      'Use LR R15,R2 to load the first number into R15.',
      'Use AR R15,R3 to add R3 to R15.',
      'Use LR R1,R2 followed by SR R1,R3 for the subtraction.',
    ],
    assertions: [
      {
        description: 'R15 contains the sum of R2 + R3 (850)',
        check: (cpu) => ({
          passed: cpu.registers[15] === 850,
          expected: '850',
          actual: cpu.registers[15].toString(),
        }),
      },
      {
        description: 'R1 contains the difference R2 - R3 (150)',
        check: (cpu) => ({
          passed: cpu.registers[1] === 150,
          expected: '150',
          actual: cpu.registers[1].toString(),
        }),
      },
    ],
  },
  {
    id: 'mission-2',
    number: 2,
    title: 'The Anchor',
    subtitle: 'Demystifying Base-Displacement Addressing D(X,B)',
    category: 'ADDRESSING',
    difficulty: 'Beginner',
    estimatedTime: '5 min',
    briefing: `Unlike modern x86 or ARM with flat 64-bit pointers, IBM Mainframe instructions allocate only 12 bits for a memory offset (0 to 4095 bytes). To reach any variable, the CPU calculates:
Address = Displacement + Base Register (+ Index Register)

To make this work, every classic mainframe routine establishes an "Anchor" base register:
  BALR R12,0    * Load address of next instruction into R12
  USING *,R12   * Tell assembler R12 now points right here (*)

Your task:
1. Load ACCT_BAL (10000) into register R2 using L.
2. Add DEPOSIT (2500) into register R2 using A.
3. Store the result from R2 into NEW_BAL using ST.`,
    conceptExplainer: {
      heading: 'RX Format: Register & Memory',
      text: `RX instructions are 4 bytes long and link a register with memory:
• L R2,ACCT_BAL loads a 32-bit fullword into R2.
• A R2,DEPOSIT adds a 32-bit fullword from memory to R2.
• ST R2,NEW_BAL writes R2 into memory.
The assembler automatically calculates the displacement for you!`,
      codeSnippet: `         BALR  R12,0       * Load PC into R12
         USING *,R12       * Register 12 is base
         L     R2,ACCT_BAL * Load memory into R2
         A     R2,DEPOSIT  * Add deposit
         ST    R2,NEW_BAL  * Store back to RAM`,
    },
    starterCode: `* ====================================================================
* MISSION 2: THE ANCHOR (BASE-DISPLACEMENT)
* Update customer balance: NEW_BAL = ACCT_BAL + DEPOSIT
* ====================================================================
BANKING  CSECT
         BALR  R12,0       * Load next instruction address into R12
         USING *,R12       * Inform assembler that R12 is our base register

* TODO: Write your code here:
* 1. Load ACCT_BAL into register R2
* 2. Add DEPOSIT to register R2
* 3. Store R2 into NEW_BAL



         BR    R14         * Exit
ACCT_BAL DC    F'10000'    * Current balance: $10,000
DEPOSIT  DC    F'2500'     * Incoming deposit: $2,500
NEW_BAL  DS    F           * Destination storage (4 bytes)
         END   BANKING
`,
    solutionCode: `BANKING  CSECT
         BALR  R12,0
         USING *,R12
         L     R2,ACCT_BAL
         A     R2,DEPOSIT
         ST    R2,NEW_BAL
         BR    R14
ACCT_BAL DC    F'10000'
DEPOSIT  DC    F'2500'
NEW_BAL  DS    F
         END   BANKING`,
    hints: [
      'Use L R2,ACCT_BAL to load the starting balance.',
      'Use A R2,DEPOSIT to add the deposit to R2.',
      'Use ST R2,NEW_BAL to store the updated balance.',
    ],
    assertions: [
      {
        description: 'NEW_BAL memory contains 12500',
        check: (cpu, res) => {
          const sym = res.symbols['NEW_BAL'];
          if (!sym) return { passed: false, expected: '12500', actual: 'NEW_BAL symbol missing' };
          const view = new DataView(cpu.memory.buffer);
          const val = view.getInt32(sym.address, false);
          return { passed: val === 12500, expected: '12500', actual: val.toString() };
        },
      },
      {
        description: 'Register R2 contains 12500',
        check: (cpu) => ({
          passed: cpu.registers[2] === 12500,
          expected: '12500',
          actual: cpu.registers[2].toString(),
        }),
      },
    ],
  },
  {
    id: 'mission-3',
    number: 3,
    title: 'The 1964 EBCDIC String Transfer',
    subtitle: 'Direct Memory-to-Memory manipulation with MVC & MVI',
    category: 'STORAGE',
    difficulty: 'Intermediate',
    estimatedTime: '5 min',
    briefing: `On IBM Mainframes, strings are encoded in EBCDIC (where space is 0x40 and 'A' is 0xC1). 
Unlike RISC processors that require loading strings through CPU registers word by word, the System/360 introduced Storage-to-Storage (SS) instructions.

MVC (Move Character) copies up to 256 bytes directly between memory locations in a single instruction!

Your task:
1. Copy the 8-character string from CARD_IN to CARD_OUT using MVC.
2. Overwrite the first byte of CARD_OUT with the immediate character 'Z' using MVI.`,
    conceptExplainer: {
      heading: 'Storage-to-Storage (SS) and Storage-Immediate (SI)',
      text: `• MVC DEST(L),SRC moves L bytes directly from SRC to DEST in memory.
• MVI DEST,C'Z' writes a single immediate byte directly to memory without touching any registers!`,
      codeSnippet: `         MVC   OUT(8),IN   * Move 8 bytes from IN to OUT
         MVI   OUT,C'Z'    * Write letter 'Z' to first byte`,
    },
    starterCode: `* ====================================================================
* MISSION 3: EBCDIC STRING TRANSFER
* Copy CARD_IN to CARD_OUT and change first char to 'Z'
* ====================================================================
STRXFER  CSECT
         BALR  R12,0
         USING *,R12

* TODO: Write your instructions:
* 1. Copy 8 bytes from CARD_IN to CARD_OUT using MVC
* 2. Replace the first character of CARD_OUT with C'Z' using MVI



         BR    R14
CARD_IN  DC    C'ACME-901' * 8-byte input record
CARD_OUT DS    CL8         * 8-byte output buffer
         END   STRXFER
`,
    solutionCode: `STRXFER  CSECT
         BALR  R12,0
         USING *,R12
         MVC   CARD_OUT(8),CARD_IN
         MVI   CARD_OUT,C'Z'
         BR    R14
CARD_IN  DC    C'ACME-901'
CARD_OUT DS    CL8
         END   STRXFER`,
    hints: [
      'Use MVC CARD_OUT(8),CARD_IN to copy all 8 bytes.',
      "Use MVI CARD_OUT,C'Z' to change the first byte.",
    ],
    assertions: [
      {
        description: "CARD_OUT contains 'ZCME-901'",
        check: (cpu, res) => {
          const sym = res.symbols['CARD_OUT'];
          if (!sym) return { passed: false, expected: 'ZCME-901', actual: 'CARD_OUT symbol missing' };
          const bytes = cpu.memory.subarray(sym.address, sym.address + 8);
          const ascii = ebcdicToAscii(bytes);
          return { passed: ascii === 'ZCME-901', expected: 'ZCME-901', actual: ascii };
        },
      },
    ],
  },
  {
    id: 'mission-4',
    number: 4,
    title: "The Banker's Penny",
    subtitle: 'Flawless Financial Math with Packed Decimal (BCD)',
    category: 'DECIMAL',
    difficulty: 'Intermediate',
    estimatedTime: '7 min',
    briefing: `Why does global banking still run on IBM Z? Because binary floating-point math makes rounding errors: 0.1 + 0.2 = 0.30000000000000004. In finance, losing fractions of a cent is illegal.

Mainframes solve this with Hardware Packed Decimal:
1. Numbers arrive as human-readable EBCDIC text ("Zoned Decimal").
2. PACK compresses two digits per byte with a sign nibble (0xC for +, 0xD for -).
3. AP (Add Packed) performs exact decimal arithmetic.
4. UNPK expands the packed number back into EBCDIC digits.

Your task:
1. Pack Z_BAL (4 bytes) into P_BAL (3 bytes) using PACK.
2. Pack Z_DEP (4 bytes) into P_DEP (3 bytes) using PACK.
3. Add P_DEP to P_BAL using AP.
4. Unpack P_BAL into Z_TOTAL (4 bytes) using UNPK.`,
    conceptExplainer: {
      heading: 'The Packed Decimal Pipeline',
      text: `• PACK P_VAR(3),Z_VAR(4) packs 4 zoned EBCDIC bytes into 3 packed bytes.
• AP P_VAR1(3),P_VAR2(3) adds the packed numbers with zero rounding error!
• UNPK Z_VAR(4),P_VAR(3) unpacks back into EBCDIC characters.`,
      codeSnippet: `         PACK  P_BAL(3),Z_BAL(4)
         PACK  P_DEP(3),Z_DEP(4)
         AP    P_BAL(3),P_DEP(3)
         UNPK  Z_TOTAL(4),P_BAL(3)`,
    },
    starterCode: `* ====================================================================
* MISSION 4: THE BANKER'S PENNY
* Perform exact decimal addition: $15.00 + $02.50 = $17.50
* ====================================================================
BANKMATH CSECT
         BALR  R12,0
         USING *,R12

* TODO: Complete the packed decimal pipeline:
* 1. PACK P_BAL(3),Z_BAL(4)
* 2. PACK P_DEP(3),Z_DEP(4)
* 3. AP P_BAL(3),P_DEP(3)
* 4. UNPK Z_TOTAL(4),P_BAL(3)



         BR    R14
Z_BAL    DC    C'1500'     * Balance: 15.00
Z_DEP    DC    C'0250'     * Deposit:  2.50
P_BAL    DS    PL3         * 3-byte packed buffer
P_DEP    DS    PL3         * 3-byte packed buffer
Z_TOTAL  DS    CL4         * Output zoned decimal string
         END   BANKMATH
`,
    solutionCode: `BANKMATH CSECT
         BALR  R12,0
         USING *,R12
         PACK  P_BAL(3),Z_BAL(4)
         PACK  P_DEP(3),Z_DEP(4)
         AP    P_BAL(3),P_DEP(3)
         UNPK  Z_TOTAL(4),P_BAL(3)
         BR    R14
Z_BAL    DC    C'1500'
Z_DEP    DC    C'0250'
P_BAL    DS    PL3
P_DEP    DS    PL3
Z_TOTAL  DS    CL4
         END   BANKMATH`,
    hints: [
      'Remember syntax: PACK DEST(L1),SRC(L2)',
      'Use AP P_BAL(3),P_DEP(3) to add the two packed numbers.',
      'Unpack with UNPK Z_TOTAL(4),P_BAL(3).',
    ],
    assertions: [
      {
        description: 'Z_TOTAL represents 1750 ($17.50)',
        check: (cpu, res) => {
          const sym = res.symbols['Z_TOTAL'];
          if (!sym) return { passed: false, expected: '1750', actual: 'Z_TOTAL symbol missing' };
          const decoded = zonedToNumber(cpu.memory, sym.address, 4);
          return { passed: decoded.value === 1750, expected: '1750', actual: decoded.value.toString() };
        },
      },
      {
        description: 'Condition code is 2 (Positive result)',
        check: (cpu) => ({
          passed: cpu.psw.conditionCode === 2,
          expected: '2 (Positive)',
          actual: cpu.psw.conditionCode.toString(),
        }),
      },
    ],
  },
  {
    id: 'mission-5',
    number: 5,
    title: 'The Tape Audit Loop',
    subtitle: 'Iterating arrays with LA, BCT, and Condition Codes',
    category: 'LOOPS',
    difficulty: 'Advanced',
    estimatedTime: '8 min',
    briefing: `Mainframe batch jobs process massive sequential files (traditionally stored on 9-track magnetic tape reels).
The classic loop pattern uses:
• A pointer/index register stepped forward with LA (Load Address).
• A counter register decremented with BCT (Branch on Count), which automatically decrements the register by 1 and branches until it hits zero!

Your task:
Sum the 4 fullword integers in the ARRAY (100, 200, 300, 400) and store the final total in register R5.
1. Initialize R5 to 0 (Accumulator).
2. Set R4 to 4 (Loop counter).
3. Set R2 to the address of ARRAY using LA R2,ARRAY.
4. In loop: Add the current fullword A R5,0(0,R2) into R5.
5. Advance pointer R2 by 4 bytes: LA R2,4(0,R2).
6. Decrement counter and loop with BCT R4,LOOP.`,
    conceptExplainer: {
      heading: 'The Mainframe BCT Loop',
      text: `• LA R1,D(X,B) can compute addresses or act as a fast pointer increment: LA R2,4(0,R2) adds 4 to R2.
• BCT R_COUNT,TARGET subtracts 1 from R_COUNT; if R_COUNT != 0, it jumps to TARGET!`,
      codeSnippet: `         LA    R4,4        * Counter = 4
         LA    R2,ARRAY    * R2 -> start of array
LOOP     A     R5,0(0,R2)  * Add item to sum
         LA    R2,4(0,R2)  * R2 += 4 bytes
         BCT   R4,LOOP     * Decrement R4, loop if > 0`,
    },
    starterCode: `* ====================================================================
* MISSION 5: THE TAPE AUDIT LOOP
* Sum the 4 integers in ARRAY into register R5
* ====================================================================
AUDIT    CSECT
         BALR  R12,0
         USING *,R12

         LA    R5,0        * R5 = 0 (Accumulator)
         LA    R4,4        * R4 = 4 (Loop Counter)
         LA    R2,ARRAY    * R2 = Address of ARRAY

* TODO: Write the loop:
* Label: LOOP
* 1. Add current array element to R5: A R5,0(0,R2)
* 2. Advance array pointer by 4 bytes: LA R2,4(0,R2)
* 3. Loop with BCT: BCT R4,LOOP



         BR    R14         * Finish
ARRAY    DC    F'100'      * Element 1
         DC    F'200'      * Element 2
         DC    F'300'      * Element 3
         DC    F'400'      * Element 4
         END   AUDIT
`,
    solutionCode: `AUDIT    CSECT
         BALR  R12,0
         USING *,R12
         LA    R5,0
         LA    R4,4
         LA    R2,ARRAY
LOOP     A     R5,0(0,R2)
         LA    R2,4(0,R2)
         BCT   R4,LOOP
         BR    R14
ARRAY    DC    F'100'
         DC    F'200'
         DC    F'300'
         DC    F'400'
         END   AUDIT`,
    hints: [
      'Label your loop instruction as LOOP in column 1.',
      'Use A R5,0(0,R2) to load through pointer R2.',
      'Use LA R2,4(0,R2) to advance the pointer by 4 bytes (the size of a Fullword).',
      'Use BCT R4,LOOP to repeat until R4 is 0.',
    ],
    assertions: [
      {
        description: 'R5 contains the sum of all 4 array items (1000)',
        check: (cpu) => ({
          passed: cpu.registers[5] === 1000,
          expected: '1000',
          actual: cpu.registers[5].toString(),
        }),
      },
      {
        description: 'R4 counter reached 0',
        check: (cpu) => ({
          passed: cpu.registers[4] === 0,
          expected: '0',
          actual: cpu.registers[4].toString(),
        }),
      },
    ],
  },
];

export interface MissionRunResult {
  success: boolean;
  assemblySuccess: boolean;
  assemblyErrors: { lineNum: number; message: string }[];
  assertions: { description: string; passed: boolean; expected: string; actual: string }[];
  stepsExecuted: number;
}

/**
 * Runs a mission by assembling source and running test assertions
 */
export function runMission(mission: Mission, sourceCode: string): MissionRunResult {
  const asm = new Assembler();
  const res = asm.assemble(sourceCode);

  if (!res.success || res.instructions.length === 0) {
    return {
      success: false,
      assemblySuccess: false,
      assemblyErrors: res.errors,
      assertions: [],
      stepsExecuted: 0,
    };
  }

  const cpu = new MainframeCPU();
  cpu.loadProgram(res.instructions, res.entryPoint);

  // Apply mission-specific pre-conditions
  if (mission.id === 'mission-1') {
    cpu.registers[2] = 500;
    cpu.registers[3] = 350;
  }

  // Execute program up to max steps
  let steps = 0;
  const MAX_STEPS = 5000;
  while (!cpu.psw.halted && steps < MAX_STEPS) {
    const active = cpu.step();
    steps++;
    if (!active) break;
  }

  const assertionResults = mission.assertions.map((a) => {
    const outcome = a.check(cpu, res);
    return {
      description: a.description,
      passed: outcome.passed,
      expected: outcome.expected,
      actual: outcome.actual,
    };
  });

  const allPassed = assertionResults.every((a) => a.passed);

  return {
    success: allPassed,
    assemblySuccess: true,
    assemblyErrors: [],
    assertions: assertionResults,
    stepsExecuted: steps,
  };
}

export interface PresetProgram {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const PRESET_PROGRAMS: PresetProgram[] = [
  {
    id: 'hello-ebcdic',
    name: '1. Hello Mainframe (EBCDIC)',
    description: 'Storage-to-Storage string copy and register inspection',
    code: `* ====================================================================
* HELLO MAINFRAME - IBM S/360 EBCDIC STRING MANIPULATION
* ====================================================================
HELLO    CSECT
         BALR  R12,0       * Set up base register
         USING *,R12
* Copy 14 bytes from GREETING to BUFFER
         MVC   BUFFER(14),GREETING
* Store length in R1 and address in R2
         LA    R1,14
         LA    R2,BUFFER
         BR    R14         * Exit
GREETING DC    C'HELLO, Z/OS!  '
BUFFER   DS    CL14
         END   HELLO
`,
  },
  {
    id: 'packed-banking',
    name: '2. Banking Packed Decimal',
    description: 'Flawless BCD financial arithmetic without floating point errors',
    code: `* ====================================================================
* BANKING LEDGER - EXACT DECIMAL ARITHMETIC
* Calculate: Ending Balance = $1250.50 + $340.25 - $100.00
* ====================================================================
LEDGER   CSECT
         BALR  R12,0
         USING *,R12
* Pack zoned EBCDIC amounts into packed decimal buffers
         PACK  P_BAL(4),Z_BAL(6)
         PACK  P_DEP(4),Z_DEP(6)
         PACK  P_WDR(4),Z_WDR(6)
* Add deposit to balance
         AP    P_BAL(4),P_DEP(4)
* Subtract withdrawal
         SP    P_BAL(4),P_WDR(4)
* Unpack final balance back into EBCDIC output
         UNPK  Z_OUT(6),P_BAL(4)
         BR    R14
Z_BAL    DC    C'125050'   * Initial Balance: $1,250.50
Z_DEP    DC    C'034025'   * Deposit:         $  340.25
Z_WDR    DC    C'010000'   * Withdrawal:      $  100.00
P_BAL    DS    PL4         * 4-byte packed decimal
P_DEP    DS    PL4
P_WDR    DS    PL4
Z_OUT    DS    CL6         * Final zoned result: 149075 ($1,490.75)
         END   LEDGER
`,
  },
  {
    id: 'prime-sieve',
    name: '3. Array Loop & Count (BCT)',
    description: 'Classic batch loop processing with index offsets',
    code: `* ====================================================================
* BATCH PROCESSING - SUM AN ARRAY OF TRANSACTIONS
* ====================================================================
SUMARRAY CSECT
         BALR  R12,0
         USING *,R12
         LA    R2,5        * R2 = 5 items to process
         LA    R3,0        * R3 = Total accumulator
         LA    R4,TRANSACT * R4 = Pointer to array
LOOP     A     R3,0(0,R4)  * Add current item to R3
         LA    R4,4(0,R4)  * Move pointer forward by 4 bytes (Fullword)
         BCT   R2,LOOP     * Decrement R2, branch if R2 > 0
         ST    R3,TOTAL    * Store final sum in TOTAL
         BR    R14
TRANSACT DC    F'15'
         DC    F'25'
         DC    F'35'
         DC    F'45'
         DC    F'55'
TOTAL    DS    F           * Total should be 175
         END   SUMARRAY
`,
  },
  {
    id: 'branch-conditions',
    name: '4. Condition Code & Mask Branching',
    description: 'Demonstrating 2-bit CC and branch mnemonics (BE, BNE, BL, BH)',
    code: `* ====================================================================
* CONDITION CODE BRANCHING - DEMONSTRATING 2-BIT CC MASKS
* ====================================================================
BRANCH   CSECT
         BALR  R12,0
         USING *,R12
         L     R2,VAL_A
         C     R2,VAL_B    * Compare R2 with VAL_B
         BH    IS_HIGH     * Branch if R2 > VAL_B (CC = 2)
         BL    IS_LOW      * Branch if R2 < VAL_B (CC = 1)
         LA    R15,0       * Equal: R15 = 0
         B     DONE
IS_HIGH  LA    R15,100     * High: R15 = 100
         B     DONE
IS_LOW   LA    R15,200     * Low: R15 = 200
DONE     BR    R14
VAL_A    DC    F'50'
VAL_B    DC    F'30'
         END   BRANCH
`,
  },
];
