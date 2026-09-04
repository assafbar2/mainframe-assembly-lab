import React from 'react';
import { Info, Cpu } from 'lucide-react';
import type { ParsedInstruction, ProgramStatusWord } from '../core/types';

interface InstructionExplainerProps {
  lastInstruction: ParsedInstruction | null;
  psw: ProgramStatusWord;
  stepCount: number;
}

export const InstructionExplainer: React.FC<InstructionExplainerProps> = ({
  lastInstruction,
  psw,
  stepCount,
}) => {
  if (!lastInstruction || stepCount === 0) {
    return (
      <div className="bg-[#0b0f12] border border-[#1b252b] rounded-lg p-3 text-xs text-zinc-400 font-mono flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-[#131b20] border border-[#202d36] flex items-center justify-center text-emerald-400 shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <div>
          <div className="font-semibold text-zinc-200">Execution Live Explainer</div>
          <div className="text-[11px] text-zinc-500">
            Press <span className="text-emerald-400 font-bold">Step</span> or <span className="text-emerald-400 font-bold">Run</span> to execute instructions and see real-time architectural insights.
          </div>
        </div>
      </div>
    );
  }

  const { mnemonic, operands, address, bytes } = lastInstruction;
  const hexBytes = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  const getEducationalContext = (m: string, _ops: string): string => {
    switch (m) {
      case 'BALR':
        return 'Branch and Link Register: Loaded the next instruction address into the first register and jumped to the second. Used in mainframes to establish the base register anchor (BALR R12,0).';
      case 'USING':
        return 'USING directive: Informed the assembler that the designated base register holds the base address, allowing base-displacement D(X,B) address calculations.';
      case 'LR':
        return 'Load Register (RR format): Copied 32 bits directly between registers inside the CPU in a single cycle without touching memory.';
      case 'AR':
        return 'Add Register: Added two 32-bit registers and updated the 2-bit Condition Code (CC) to reflect zero, negative, positive, or overflow.';
      case 'SR':
        return 'Subtract Register: Subtracted second register from first. Sets Condition Code (CC 0 for equal/zero, CC 1 for negative).';
      case 'L':
        return 'Load Fullword (RX format): Loaded a 32-bit signed integer from memory into the register using Base-Displacement addressing D(X,B).';
      case 'ST':
        return 'Store Fullword (RX format): Saved a 32-bit register directly into mainframe memory.';
      case 'LA':
        return 'Load Address (RX format): Computed the effective address D + Base + Index without reading memory. Commonly used for pointer math or loading constants!';
      case 'MVC':
        return 'Move Character (Storage-to-Storage / SS format): Copied bytes directly between two memory buffers from left to right without passing through CPU registers.';
      case 'MVI':
        return 'Move Immediate (SI format): Injected an 8-bit immediate byte directly into memory without touching any registers.';
      case 'PACK':
        return 'PACK (SS format): Converted zoned decimal (EBCDIC digits) into hardware packed decimal (BCD) nibbles, preparing for exact banking arithmetic.';
      case 'UNPK':
        return 'UNPACK (SS format): Converted packed decimal back into zoned EBCDIC characters for display or output.';
      case 'AP':
        return 'Add Packed (SS format): Added two packed decimal numbers in memory with exact precision, completely preventing binary floating-point rounding errors.';
      case 'SP':
        return 'Subtract Packed (SS format): Subtracted two packed decimal numbers in memory and set the Condition Code.';
      case 'BCT':
        return 'Branch on Count: Decremented the counter register by 1. Since it was not zero, the CPU branched to the target address.';
      case 'BC':
      case 'B':
      case 'BE':
      case 'BNE':
      case 'BL':
      case 'BH':
        return `Branch on Condition: Checked the 2-bit Condition Code in the PSW. Branch test evaluated to ${psw.instructionAddress === address + bytes.length ? 'FALSE (fall-through)' : 'TRUE (jumped)'}.`;
      case 'BR':
        return 'Branch to Register: Jumped to the address stored in the register. BR R14 is the universal standard mainframe return instruction!';
      default:
        return `Executed ${mnemonic} with operands ${operands}. Updated CPU state and advanced PSW.`;
    }
  };

  const explanation = getEducationalContext(mnemonic, operands);

  return (
    <div className="bg-[#0b0f12] border border-[#1b252b] rounded-lg p-3 text-xs font-mono shadow-lg flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-[#1a252b] pb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Cpu className="w-3 h-3" />
          </div>
          <span className="font-bold text-zinc-200">
            Executed: <span className="text-emerald-400">{mnemonic} {operands}</span>
          </span>
        </div>

        <div className="text-[11px] text-zinc-400">
          Bytecode: <span className="text-amber-400 tracking-wider font-semibold">{hexBytes}</span>
        </div>
      </div>

      <div className="text-[11px] text-zinc-300 leading-relaxed bg-[#0f1418] border border-[#1a252c] rounded p-2">
        <span className="text-emerald-400 font-bold mr-1">Insight:</span>
        {explanation}
      </div>
    </div>
  );
};
