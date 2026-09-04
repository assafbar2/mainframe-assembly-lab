import React, { useState } from 'react';
import { BookOpen, Layers, Hash, Binary, Sparkles, X } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'basedisp' | 'packed' | 'ebcdic' | 'cc'>('basedisp');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0b0f12] border border-[#23333d] rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c272e] bg-[#0f1418]">
          <div className="flex items-center gap-2 text-emerald-400">
            <BookOpen className="w-4 h-4" />
            <h2 className="font-bold text-sm tracking-wide text-zinc-100">
              IBM Mainframe Architecture Deep Dive
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#182329]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#1c272e] bg-[#0a0d10] px-4 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('basedisp')}
            className={`flex items-center gap-1.5 pb-2 px-2 border-b-2 font-semibold transition-all ${
              activeTab === 'basedisp'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Base-Displacement</span>
          </button>

          <button
            onClick={() => setActiveTab('packed')}
            className={`flex items-center gap-1.5 pb-2 px-2 border-b-2 font-semibold transition-all ${
              activeTab === 'packed'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>2. Packed Decimal (BCD)</span>
          </button>

          <button
            onClick={() => setActiveTab('ebcdic')}
            className={`flex items-center gap-1.5 pb-2 px-2 border-b-2 font-semibold transition-all ${
              activeTab === 'ebcdic'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Binary className="w-3.5 h-3.5" />
            <span>3. EBCDIC Character Set</span>
          </button>

          <button
            onClick={() => setActiveTab('cc')}
            className={`flex items-center gap-1.5 pb-2 px-2 border-b-2 font-semibold transition-all ${
              activeTab === 'cc'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>4. 2-Bit Condition Code</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-zinc-300 leading-relaxed text-xs">
          {activeTab === 'basedisp' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-emerald-400">
                Why Mainframes Don't Have Flat Pointers: The D(X,B) Model
              </h3>
              <p>
                When IBM designed the System/360 in 1964 under Gene Amdahl and Fred Brooks, memory was extraordinarily expensive. Storing 32-bit or 64-bit absolute addresses inside every single memory instruction would waste over 50% of program storage!
              </p>
              <p>
                Their brilliant solution was <strong>Base-Displacement Addressing</strong>:
              </p>

              <div className="bg-[#070a0c] p-3 rounded border border-[#172127] space-y-2">
                <div className="text-amber-300 font-bold">
                  Effective Address = Displacement (12 bits) + Base Register + Index Register
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                  <div className="bg-[#12191e] p-2 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">D (0 - 4095)</div>
                    <div className="text-zinc-400 text-[10px]">12-bit unsigned offset</div>
                  </div>
                  <div className="bg-[#12191e] p-2 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">X (0 - 15)</div>
                    <div className="text-zinc-400 text-[10px]">Index Register (optional)</div>
                  </div>
                  <div className="bg-[#12191e] p-2 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">B (0 - 15)</div>
                    <div className="text-zinc-400 text-[10px]">Base Register (Anchor)</div>
                  </div>
                </div>
              </div>

              <p>
                Because displacement is limited to 4096 bytes (4KB), every routine anchors itself to a base register (conventionally R12) using:
              </p>
              <pre className="bg-[#070a0c] p-2.5 rounded border border-[#172127] text-emerald-300 text-[11px]">
{`         BALR  R12,0       * Load PC into R12
         USING *,R12       * Register 12 is base address`}
              </pre>
              <p>
                The assembler automatically subtracts the base register address from the symbol address to compute the 12-bit displacement at assemble time!
              </p>
            </div>
          )}

          {activeTab === 'packed' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-emerald-400">
                The Banker's Secret Weapon: Hardware Packed Decimal
              </h3>
              <p>
                In modern languages (Python, JavaScript, C++), numbers are usually binary floats:
              </p>
              <pre className="bg-[#070a0c] p-2 rounded border border-[#172127] text-red-300 text-[11px]">
{`// In JavaScript:
0.1 + 0.2 === 0.30000000000000004  // TRUE! Rounding error!`}
              </pre>
              <p>
                In global financial institutions (clearing houses, Visa/Mastercard networks, banking ledgers), losing even a single micro-cent can lead to massive discrepancies and legal penalties.
              </p>
              <p>
                IBM mainframes solve this with <strong>Hardware Packed Decimal</strong>:
              </p>
              <div className="bg-[#070a0c] p-3 rounded border border-[#172127] space-y-2">
                <div className="text-zinc-200">
                  Number: <span className="text-amber-300 font-bold">+1234</span>
                </div>
                <div className="text-zinc-400 text-[11px]">
                  Stored as 3 bytes (5 decimal digits + sign nibble):
                </div>
                <div className="flex gap-2 font-mono text-center">
                  <div className="bg-[#12191e] px-3 py-1.5 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">0x01</div>
                    <div className="text-[10px] text-zinc-500">Digits 0, 1</div>
                  </div>
                  <div className="bg-[#12191e] px-3 py-1.5 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">0x23</div>
                    <div className="text-[10px] text-zinc-500">Digits 2, 3</div>
                  </div>
                  <div className="bg-[#12191e] px-3 py-1.5 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">0x4C</div>
                    <div className="text-[10px] text-zinc-500">Digit 4 + Sign 'C' (+)</div>
                  </div>
                </div>
              </div>
              <p>
                Instructions like <code>AP</code> (Add Packed) and <code>SP</code> (Subtract Packed) perform pure base-10 decimal arithmetic directly in silicon, guaranteeing 100% exact cent precision forever.
              </p>
            </div>
          )}

          {activeTab === 'ebcdic' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-emerald-400">
                EBCDIC: Extended Binary Coded Decimal Interchange Code
              </h3>
              <p>
                Created in 1964 for the IBM System/360, EBCDIC is derived from 80-column punched cards (Hollerith cards).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#070a0c] p-2.5 rounded border border-[#172127]">
                  <span className="text-emerald-400 font-bold">Space Character</span>
                  <p className="text-zinc-400 mt-1">
                    In ASCII, space is <code>0x20</code> (32). In EBCDIC, space is <code>0x40</code> (64).
                  </p>
                </div>

                <div className="bg-[#070a0c] p-2.5 rounded border border-[#172127]">
                  <span className="text-emerald-400 font-bold">Digits 0 - 9</span>
                  <p className="text-zinc-400 mt-1">
                    In ASCII, digits are <code>0x30 - 0x39</code>. In EBCDIC, digits are <code>0xF0 - 0xF9</code>.
                  </p>
                </div>
              </div>

              <div className="bg-[#070a0c] p-3 rounded border border-[#172127] space-y-1">
                <span className="text-amber-300 font-bold">The Non-Contiguous Alphabet:</span>
                <p className="text-zinc-400 text-[11px]">
                  In ASCII, letters 'A' to 'Z' are contiguous numbers (65 to 90). In EBCDIC, letters are split into 3 separate groups because of punch card zones:
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1">
                  <div className="bg-[#12191e] p-1.5 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">A - I</div>
                    <div>0xC1 - 0xC9</div>
                  </div>
                  <div className="bg-[#12191e] p-1.5 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">J - R</div>
                    <div>0xD1 - 0xD9</div>
                  </div>
                  <div className="bg-[#12191e] p-1.5 rounded border border-[#1e2a32]">
                    <div className="text-emerald-400 font-bold">S - Z</div>
                    <div>0xE2 - 0xE9</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cc' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-emerald-400">
                2-Bit Condition Codes & Branch Masks
              </h3>
              <p>
                Instead of separate boolean status flags (Zero Flag, Carry Flag, Sign Flag), the IBM Mainframe Program Status Word (PSW) has a concise <strong>2-bit Condition Code</strong> with 4 states:
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#070a0c] p-2 rounded border border-[#172127]">
                  <span className="text-emerald-400 font-bold">CC = 0</span>
                  <div className="text-zinc-400">Equal / Zero / No Overflow</div>
                </div>
                <div className="bg-[#070a0c] p-2 rounded border border-[#172127]">
                  <span className="text-emerald-400 font-bold">CC = 1</span>
                  <div className="text-zinc-400">First operand Low / Negative</div>
                </div>
                <div className="bg-[#070a0c] p-2 rounded border border-[#172127]">
                  <span className="text-emerald-400 font-bold">CC = 2</span>
                  <div className="text-zinc-400">First operand High / Positive</div>
                </div>
                <div className="bg-[#070a0c] p-2 rounded border border-[#172127]">
                  <span className="text-emerald-400 font-bold">CC = 3</span>
                  <div className="text-zinc-400">Arithmetic Overflow</div>
                </div>
              </div>

              <p>
                Branch instructions evaluate a 4-bit mask <code>M1</code>:
              </p>
              <pre className="bg-[#070a0c] p-2.5 rounded border border-[#172127] text-emerald-300 text-[11px]">
{`* Branch if Condition (BC Mask, Target):
BE TARGET  * BC 8,TARGET  (Tests CC 0)
BL TARGET  * BC 4,TARGET  (Tests CC 1)
BH TARGET  * BC 2,TARGET  (Tests CC 2)
B  TARGET  * BC 15,TARGET (Unconditional jump)`}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1c272e] bg-[#0f1418] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs shadow-md transition-all"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
